'use client';

import RegisterCourseForm from '@/components/registerCourse'
import { getLtik } from '@/lib/ltik';
import ky from 'ky';
import React, { useEffect } from 'react'

function courseRegisterPage() {
  const [courseInfo, setCourseInfo] = React.useState();
  const [passes, setPasses] = React.useState();

  useEffect(() => {
    async function fetchCourseInfo() {
      try {
        const course_info = await ky.get(`/lti/course_info`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        setCourseInfo(course_info);
        console.log("Course Info:", course_info);

        const passes_info = await ky.get(`/api/pass`, {
          credentials: "include",
          headers: { Authorization: "Bearer " + getLtik() },
        })
        .json();
      setPasses(passes_info);
      console.log("Pass Info:", passes_info);

      } catch (error) {
        console.error("Error fetching course info:", error);
      }
    }

    fetchCourseInfo();
  }, []);

  if (!courseInfo || !passes) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
        <RegisterCourseForm 
          courseCanvasId={courseInfo.canvas_course_id}
          title={courseInfo.title}
          description={courseInfo.description}
          instructorCanvasId={courseInfo.canvas_instructor_id}
          passes={passes}
        />
    </div>
  )
}

export default courseRegisterPage