'use client';

import RegisterCourseForm from '@/components/registerCourse'
import { getLtik } from '@/lib/ltik';
import ky from 'ky';
import React, { useEffect } from 'react'

function courseRegisterPage() {
  const [courseInfo, setCourseInfo] = React.useState();
  const [passes, setPasses] = React.useState();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  useEffect(() => {
    async function fetchCourseInfo() {
      try {
        setLoading(true);
        setError(null);
        
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
        setError("Failed to load course information. Please try refreshing the page.");
      } finally {
        setLoading(false);
      }
    }

    fetchCourseInfo();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading course setup...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="text-red-600 text-6xl">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900">Setup Error</h2>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!courseInfo || !passes) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-gray-400 text-6xl">❌</div>
          <h2 className="text-xl font-semibold text-gray-900">Missing Information</h2>
          <p className="text-gray-600">Unable to load course or pass information.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
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