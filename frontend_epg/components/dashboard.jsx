"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PassUsageHistoryTable } from "./passUsageHistoryTable";
import { getLtik } from "@/lib/ltik";
import ky from "ky";

export function Dashboard({ studentCanvasId, courseCanvasId }) {
  const [studentInfo, setStudentInfo] = useState();

  useEffect(() => {
    async function fetchStudentInfo() {
      try {
        const student_info = await ky
          //   .get(`/api/enrollment/${courseCanvasId}?studentCanvasId=${studentCanvasId}`, {
          .get(`/api/enrollment/course001?studentCanvasId=stud002`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        setStudentInfo(student_info[0]);

        console.log("Student info:", student_info);
      } catch (error) {
        console.error("Error fetching pass info:", error);
      }
    }

    fetchStudentInfo();
  }, []);

  if (!studentInfo) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <h1 className="text-l font-bold">Free Passes Remaining</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {Object.entries(studentInfo.passesLeft).map(([title, quantity]) => (
          <Card key={title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{quantity}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h1 className="text-m font-bold">Free Passes Usage History</h1>
      <PassUsageHistoryTable usedPasses={studentInfo.freePasses}/>
    </>
  );
}
