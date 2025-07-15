"use client";
import React, { useEffect, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Users, Clock } from "lucide-react";
import ky from "ky";
import { getLtik } from "@/lib/ltik";

export function AssignmentAnalytics({ assignment, courseCanvasId }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchAnalytics() {
      if (!assignment || !courseCanvasId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await ky.get(
          `/api/assignment/${assignment.canvasId}/analytics?courseCanvasId=${courseCanvasId}`,
          {
            headers: { Authorization: "Bearer " + getLtik() },
          }
        ).json();
        setAnalytics(data);
      } catch (err) {
        setError("Failed to load analytics data.");
        console.error("Error fetching assignment analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [assignment, courseCanvasId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!analytics) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No analytics data available for this assignment.</AlertDescription>
      </Alert>
    );
  }

  // Prepare scatter plot data - each point represents a student
  const scatterData = analytics.studentDataPoints?.map((point, index) => ({
    x: point.daysBeforeDue,
    y: index + 1, // Simple index for Y-axis
    studentId: point.studentId,
    usedAt: point.usedAt,
    size: 8 // Point size
  })) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{analytics.totalStudents}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Used Free Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{analytics.usedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4" /> Did Not Use Pass
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">{analytics.notUsedCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> When Did Each Student Use Their Pass?
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scatterData.length === 0 ? (
            <div className="text-center text-gray-500">No students used a pass for this assignment.</div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <ScatterChart
                margin={{
                  top: 20,
                  right: 20,
                  bottom: 20,
                  left: 20,
                }}
              >
                <CartesianGrid />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="Days Before Due"
                  label={{ value: 'Days Before Due Date', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="Student"
                  label={{ value: 'Students', angle: -90, position: 'insideLeft' }}
                  hide={true} // Hide Y-axis labels since they're just indices
                />
                <ZAxis type="number" range={[60, 400]} />
                <Tooltip 
                  formatter={(value, name, props) => [
                    `${props.payload.daysBeforeDue} days before due`,
                    `Student ${props.payload.studentId}`
                  ]}
                  labelFormatter={() => "Pass Usage"}
                />
                <Scatter name="Students" data={scatterData} fill="#4F46E5" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
          <div className="mt-4 text-sm text-gray-600 text-center">
            Each point represents a student. X-axis shows days before the due date when they used their pass.
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 