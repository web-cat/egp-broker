"use client";
import ky from "ky";
import { useEffect, useState } from "react";
import { AssignmentTable } from "./assignmnetTable";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { getLtik } from "@/lib/ltik";
import CanvasAssignmentManager from "./canvasAssignmentManager";

function InstructorDashboard({ courseCanvasId }) {
  const [usedFreePasses, setUsedFreePasses] = useState([]);
  const [instructorCanvasId, setInstructorCanvasId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsedFreePasses = async () => {
      try {
        const usedFreePasses = await ky
        //   .get(`/api/enrollment/${courseCanvasId}/usedFreePasses`, {
          .get(`/api/enrollment/course001/usedFreePasses`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        console.log("usedFreePasses:", usedFreePasses);
        setUsedFreePasses(usedFreePasses);
      } catch (err) {
        console.error("Error fetching used FreePasses:", err);
      }
    };

    const fetchInstructorInfo = async () => {
      try {
        const info = await ky.get(`/lti/info`, {
          credentials: "include",
          headers: { Authorization: "Bearer " + getLtik() },
        }).json();
        console.log("LTI Info:", info);
        console.log("Canvas User ID:", info.canvas_user_id);
        setInstructorCanvasId(info.canvas_user_id || "");
      } catch (err) {
        console.error("Error fetching instructor info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsedFreePasses();
    fetchInstructorInfo();
  }, []);

  if (loading) {
    return <div>Loading instructor information...</div>;
  }

  if (!usedFreePasses) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex">
        <div className="w-1/2 mr-1">
          <h1 className="text-xl font-bold mb-2">Recently Used Free Passes</h1>
          <ScrollArea className="grid grid-cols-1 gap-4">
            {usedFreePasses.map((pass) => (
              <Card className="mb-3" key={pass._id}>
                <CardHeader>
                  <CardTitle>
                    {pass.firstName} {pass.lastName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p>{pass.assignmentTitle}</p>
                  <p>{pass.passName}</p>
                  <p>{new Date(pass.usedAt).toLocaleDateString()}</p>
                </CardContent>
              </Card>
            ))}
          </ScrollArea>
        </div>
        <div className="w-1/2 ml-1 mb-2">
          <h1 className="text-xl font-bold">Assignments</h1>
          <AssignmentTable courseCanvasId={courseCanvasId} />
        </div>
      </div>

      {/* Canvas Assignment Manager */}
      {instructorCanvasId ? (
        <div>
          <CanvasAssignmentManager 
            courseCanvasId={courseCanvasId} 
            instructorCanvasId={instructorCanvasId} 
          />
        </div>
      ) : (
        <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg">
          <p className="text-yellow-800">
            Warning: Instructor Canvas ID not available. Canvas Assignment Manager is disabled.
          </p>
          <p className="text-sm text-yellow-600 mt-1">
            Debug info: instructorCanvasId = "{instructorCanvasId}"
          </p>
        </div>
      )}
    </div>
  );
}

export default InstructorDashboard;
