"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLtik } from "@/lib/ltik";
import ky from "ky";
import {
  Award,
  Clock,
  FileText,
  Calendar,
  CheckCircle,
  AlertCircle,
  Plus,
  History,
  BookOpen,
  TrendingUp,
  Activity
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

export function Dashboard({ studentCanvasId, courseCanvasId, instructorCanvasId }) {
  const [studentInfo, setStudentInfo] = useState();
  const [currentAssignments, setCurrentAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [selectedPass, setSelectedPass] = useState(null);
  const [actualInstructorId, setActualInstructorId] = useState(instructorCanvasId);
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [pendingAssignment, setPendingAssignment] = useState(null);
  const [pendingPass, setPendingPass] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");

  useEffect(() => {
    async function fetchStudentData() {
      try {
        setLoading(true);

        // Fetch student enrollment and pass information
        const student_info = await ky
          .get(`/api/enrollment/${courseCanvasId}?studentCanvasId=${studentCanvasId}`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        setStudentInfo(student_info[0]);

        // Get instructor Canvas ID if not provided as prop
        let instructorId = instructorCanvasId;
        if (!instructorId) {
          try {
            // Get instructor ID from course endpoint
            const courseInstructor = await ky
              .get(`/api/course/${courseCanvasId}/instructor`, {
                credentials: "include",
                headers: { Authorization: "Bearer " + getLtik() },
              })
              .json();

            instructorId = courseInstructor.instructorCanvasId;
            console.log("Course instructor:", courseInstructor);

          } catch (instructorError) {
            console.error("Error fetching course instructor:", instructorError);
            // Fallback: try to get from LTI context
            try {
              const ltiInfo = await ky.get(`/lti/info`, {
                credentials: "include",
                headers: { Authorization: "Bearer " + getLtik() },
              }).json();

              console.log("LTI Info:", ltiInfo);

              // TODO: Implement proper instructor ID fetching for students
              // This could be:
              // 1. From course enrollment data
              // 2. From a course info endpoint
              // 3. Passed down from parent component
              // 4. Stored in course metadata

              // For now, we'll use a placeholder
              instructorId = "instructor_canvas_id_placeholder";
            } catch (ltiError) {
              console.error("Error fetching LTI info:", ltiError);
              instructorId = "instructor_canvas_id_placeholder";
            }
          }
        }

        setActualInstructorId(instructorId);

        // Fetch current assignments from backend sync endpoint
        if (instructorId && instructorId !== "instructor_canvas_id_placeholder") {
          try {
            console.log(`Syncing assignments for course ${courseCanvasId} using instructor ${instructorId}`);
            const assignments_data = await ky
              .post(`/api/assignment/sync/${courseCanvasId}`, {
                json: { instructorCanvasId: instructorId },
                credentials: "include",
                headers: { Authorization: "Bearer " + getLtik() },
              })
              .json();
            console.log("Synced Assignments for student:", assignments_data);
            setCurrentAssignments(assignments_data);
            // Show success message in console
            console.log(`✅ Successfully loaded ${assignments_data.length} assignments from DB`);
          } catch (syncError) {
            console.error("Error syncing assignments:", syncError);
            setCurrentAssignments(getMockAssignments());
          }
        } else {
          // Use mock data if no instructor ID available
          console.log("⚠️ No instructor ID available, using mock assignments");
          setCurrentAssignments(getMockAssignments());
        }

        console.log("Student info:", student_info);
      } catch (error) {
        console.error("Error fetching student data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStudentData();
  }, [courseCanvasId, instructorCanvasId]);

  // TODO: remove this
  // Helper function for mock assignments
  const getMockAssignments = () => {
    return [
      {
        id: "1",
        name: "Assignment 1: Introduction",
        due_at: "2024-12-20T23:59:00Z",
        points_possible: 100,
        published: true,
        assignment_group_name: "Homework"
      },
      {
        id: "2",
        name: "Assignment 2: Advanced Topics",
        due_at: "2024-12-25T23:59:00Z",
        points_possible: 150,
        published: true,
        assignment_group_name: "Projects"
      },
      {
        id: "3",
        name: "Assignment 3: Final Project",
        due_at: "2024-12-30T23:59:00Z",
        points_possible: 200,
        published: true,
        assignment_group_name: "Final"
      }
    ];
  };

  // Updated handleApplyPass to open dialog
  const handleApplyPass = (assignmentId, passId) => {
    const assignment = currentAssignments.find(a => a._id === assignmentId);
    const pass = studentInfo.passesLeft.find(p => p.passId._id === passId);
    setPendingAssignment(assignment);
    setPendingPass(pass);
    setApplyMessage("");
    setPassDialogOpen(true);
  };

  // Confirm pass application
  const confirmApplyPass = async () => {
    if (!pendingAssignment || !pendingPass) return;
    setApplying(true);
    setApplyMessage("");
    try {
      const response = await ky.post("/api/pass/apply", {
        json: {
          studentCanvasId,
          assignmentCanvasId: pendingAssignment.canvasId,
          courseCanvasId,
          passId: pendingPass.passId._id,
        },
        credentials: "include",
        headers: { Authorization: "Bearer " + getLtik() },
      }).json();
      // Update UI: decrement pass count, add to usedPasses
      setStudentInfo(prev => {
        if (!prev) return prev;
        // Decrement pass count
        const newPassesLeft = prev.passesLeft.map(p =>
          p.passId._id === pendingPass.passId._id
            ? { ...p, count: p.count - 1 }
            : p
        );
        // Add to freePasses
        const newFreePasses = [
          ...prev.freePasses,
          {
            passId: pendingPass.passId,
            usedAt: new Date().toISOString(),
            assignmentId: pendingAssignment._id,
          },
        ];
        return { ...prev, passesLeft: newPassesLeft, freePasses: newFreePasses };
      });
      setApplyMessage("Pass applied successfully!");
      setTimeout(() => {
        setPassDialogOpen(false);
        setPendingAssignment(null);
        setPendingPass(null);
        setApplyMessage("");
      }, 1500);
    } catch (err) {
      let msg = "Failed to apply pass.";
      if (err && err.response) {
        try {
          const data = await err.response.json();
          // Show all error fields if present
          msg = data.error || data.errors?.[0] || data.message || JSON.stringify(data) || msg;
        } catch (e) {
          msg = err.message || msg;
        }
      } else if (err && err.message) {
        msg = err.message;
      }
      setApplyMessage(msg);
    } finally {
      setApplying(false);
    }
  };

  // TODO: Implement assignment filtering logic
  const getEligibleAssignments = (assignments) => {
    // TODO: Filter assignments based on:
    // 1. Assignment is published and available
    // 2. Assignment hasn't already had a pass applied to it
    // 3. Assignment is within the time window for pass usage
    // 4. Assignment type is eligible for the specific pass type

    return assignments.filter(assignment => assignment.published);
  };

  // TODO: Implement pass eligibility checking
  const isPassEligible = (pass, assignment) => {
    // TODO: Check if the pass can be applied to this assignment:
    // 1. Pass type matches assignment requirements
    // 2. Pass hasn't expired
    // 3. Assignment hasn't already been extended
    // 4. Student has sufficient passes remaining

    return pass.count > 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="text-center py-8 text-red-600">
        <AlertCircle className="h-8 w-8 mx-auto mb-2" />
        <p>Unable to load student information</p>
      </div>
    );
  }

  const eligibleAssignments = getEligibleAssignments(currentAssignments);
  const availablePasses = studentInfo.passesLeft.filter(pass => pass.count > 0);
  const usedPasses = studentInfo.freePasses;

  console.log("Assignments in UI:", currentAssignments);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Course ID: {courseCanvasId} | Student ID: {studentCanvasId}
        </p>
      </div>

      {/* Pass Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Passes Available</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {availablePasses.reduce((sum, pass) => sum + pass.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all pass types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Passes Used</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usedPasses.length}</div>
            <p className="text-xs text-muted-foreground">
              All time usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Assignments</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eligibleAssignments.length}</div>
            <p className="text-xs text-muted-foreground">
              Available for pass usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usedPasses.filter(pass => {
                const usedDate = new Date(pass.usedAt);
                const oneWeekAgo = new Date();
                oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
                return usedDate > oneWeekAgo;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Available Passes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Available Passes
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Your remaining passes that can be applied to assignments
          </p>
        </CardHeader>
        <CardContent>
          {availablePasses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availablePasses.map((pass) => (
                <Card key={pass.passId._id} className="border-2 border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{pass.passId.name}</h3>
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        {pass.count} available
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{pass.passId.description}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <BookOpen className="h-3 w-3" />
                      <span>{pass.passId.passType} pass</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Award className="h-8 w-8 mx-auto mb-2" />
              <p>No passes available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Assignments - Apply Passes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Current Assignments
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Apply your passes to extend deadlines or get additional attempts
          </p>
        </CardHeader>
        <CardContent>
          {eligibleAssignments.length > 0 ? (
            <div className="space-y-4">
              {eligibleAssignments.map((assignment) => (
                <Card key={assignment._id || assignment.id} className="border-l-4 border-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">{assignment.title || assignment.name}</h3>
                          <Badge variant="outline">{assignment.assignment_group_name}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                          {assignment.dueDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                          {assignment.points_possible && (
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              <span>{assignment.points_possible} points</span>
                            </div>
                          )}
                        </div>
                        {/* Pass Application Section */}
                        <div className="border-t pt-4">
                          <h4 className="font-medium text-sm mb-3">Apply Pass:</h4>
                          <div className="flex flex-wrap gap-2">
                            {availablePasses.map((pass) => (
                              <Button
                                key={pass.passId._id}
                                variant="outline"
                                size="sm"
                                disabled={!isPassEligible(pass, assignment) || applying}
                                onClick={() => handleApplyPass(assignment._id, pass.passId._id)}
                                className="text-xs"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                {pass.passId.name} ({pass.count})
                              </Button>
                            ))}
                          </div>
                          {availablePasses.length === 0 && (
                            <p className="text-sm text-gray-500">No passes available to apply</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2" />
              <p>No assignments available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pass Usage History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Pass Usage History
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Track all the passes you've used and their outcomes
          </p>
        </CardHeader>
        <CardContent>
          {usedPasses.length > 0 ? (
            <div className="space-y-3">
              {usedPasses
                .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
                .map((pass, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 border rounded-lg">
                    <div className="flex-shrink-0">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900">{pass.passName}</h4>
                        <Badge variant="outline" className="text-xs">
                          Used
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Applied to: {pass.assignmentTitle}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(pass.usedAt).toLocaleDateString()} at {new Date(pass.usedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <History className="h-8 w-8 mx-auto mb-2" />
              <p>No pass usage history</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pass Application Confirmation Dialog */}
      <Dialog open={passDialogOpen} onOpenChange={setPassDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Pass</DialogTitle>
            <DialogDescription>
              {pendingAssignment && pendingPass && (
                <>
                  <div className="mb-2">
                    <strong>Assignment:</strong> {pendingAssignment.title}
                  </div>
                  <div className="mb-2">
                    <strong>Pass Type:</strong> {pendingPass.passId.name}
                  </div>
                  <div className="mb-2">
                    <strong>Effect:</strong> {pendingPass.passId.details?.durationHours ? `Extends deadline by ${pendingPass.passId.details.durationHours} hours` : pendingPass.passId.description}
                  </div>
                  <div className="mb-2">
                    <strong>Remaining:</strong> {pendingPass.count}
                  </div>
                </>
              )}
              Are you sure you want to apply this pass?
            </DialogDescription>
          </DialogHeader>
          {applyMessage && (
            <div className={`text-sm mb-2 ${applyMessage.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{applyMessage}</div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={applying}>Cancel</Button>
            </DialogClose>
            <Button onClick={confirmApplyPass} disabled={applying}>
              {applying ? "Applying..." : "Apply Pass"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <div className="border-t pt-4 text-center text-sm text-gray-500">
        <p>Dashboard last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
