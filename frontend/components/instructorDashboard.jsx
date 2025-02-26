"use client";
import ky from "ky";
import { useEffect, useState } from "react";
import { AssignmentTable } from "./assignmnetTable";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { getLtik } from "@/lib/ltik";

function InstructorDashboard({ courseCanvasId }) {
  const [usedFreePasses, setUsedFreePasses] = useState([]);

  useEffect(() => {
    const fetchUsedFreePasses = async () => {
      try {
        const usedFreePasses = await ky
          .get(`/api/enrollment/${courseCanvasId}/usedFreePasses`, {
        //   .get(`/api/enrollment/course001/usedFreePasses`, {
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
    fetchUsedFreePasses();
  }, []);

  if (!usedFreePasses) {
    return <div>Loading...</div>;
  }

  return (
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
  );
}

export default InstructorDashboard;
