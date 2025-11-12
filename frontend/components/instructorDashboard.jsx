"use client";
import ky from "ky";
import { useEffect, useState } from "react";
import { AssignmentTable } from "./assignmnetTable";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import {getAuthHeaders, getLtik} from "@/lib/ltik";
import CanvasAssignmentManager from "./canvasAssignmentManager";
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  TrendingUp,
  Calendar,
  BookOpen,
  Award,
  Activity
} from "lucide-react";

function InstructorDashboard({ courseCanvasId }) {
  const [usedFreePasses, setUsedFreePasses] = useState([]);
  const [instructorCanvasId, setInstructorCanvasId] = useState("");
  const [loading, setLoading] = useState(true);
  const [courseStats, setCourseStats] = useState({
    totalStudents: 0,
    totalAssignments: 0,
    totalPassesUsed: 0,
    recentPassUsage: 0,
    averagePassesPerStudent: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [passUsageByType, setPassUsageByType] = useState({});

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch instructor info
        const info = await ky.get(`/lti/info`, {
          credentials: "include",
          headers: { Authorization: "Bearer " + getLtik() },
        }).json();
        console.log("LTI Info:", info);
        setInstructorCanvasId(info.canvas_user_id || "");

        // Fetch used free passes
        const usedFreePasses = await ky
          .get(`/api/enrollment/${courseCanvasId}/usedFreePasses`, {
            credentials: "include",
            headers: getAuthHeaders(),
          })
          .json();
        setUsedFreePasses(usedFreePasses);

        // Fetch course statistics
        const enrollments = await ky
          .get(`/api/enrollment/${courseCanvasId}`, {
            credentials: "include",
              headers: getAuthHeaders(),
          })
          .json();

        // Calculate statistics
        const totalStudents = enrollments.length;
        const totalPassesUsed = usedFreePasses.length;
        const recentPassUsage = usedFreePasses.filter(pass => {
          const usedDate = new Date(pass.usedAt);
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
          return usedDate > oneWeekAgo;
        }).length;

        // Calculate pass usage by type
        const passTypeCounts = {};
        usedFreePasses.forEach(pass => {
          const passName = pass.passName;
          passTypeCounts[passName] = (passTypeCounts[passName] || 0) + 1;
        });

        // Get recent activity (last 10 pass usages)
        const recentActivityData = usedFreePasses
          .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
          .slice(0, 10);

        setCourseStats({
          totalStudents,
          totalAssignments: 0, // Will be updated when assignments are fetched
          totalPassesUsed,
          recentPassUsage,
          averagePassesPerStudent: totalStudents > 0 ? (totalPassesUsed / totalStudents).toFixed(1) : 0
        });

        setRecentActivity(recentActivityData);
        setPassUsageByType(passTypeCounts);

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [courseCanvasId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Course ID: {courseCanvasId} | Instructor ID: {instructorCanvasId}
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">
              Enrolled in course
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passes Used</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStats.totalPassesUsed}</div>
            <p className="text-xs text-muted-foreground">
              All time usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStats.recentPassUsage}</div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Passes/Student</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{courseStats.averagePassesPerStudent}</div>
            <p className="text-xs text-muted-foreground">
              Per student average
            </p>
          </CardContent>
        </Card>
      </div>
 

      {/* Course Assignments - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Course Assignments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            All assignments organized by groups with detailed information
          </p>
        </CardHeader>
        <CardContent>
          <AssignmentTable 
            courseCanvasId={courseCanvasId} 
            instructorCanvasId={instructorCanvasId}
          />
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="border-t pt-4 text-center text-sm text-gray-500">
        <p>Dashboard last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

export default InstructorDashboard;
