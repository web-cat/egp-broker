"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLtik } from "@/lib/ltik";
import ky from "ky";
import { getAuthHeaders } from "@/lib/ltik";

export default function CanvasAssignmentManager({ courseCanvasId, instructorCanvasId }) {
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [studentCanvasId, setStudentCanvasId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Fetch assignments for the course
  const fetchAssignments = async () => {
    setLoading(true);
    setMessage("");
    try {
      console.log("Fetching assignments for course:", courseCanvasId);
      console.log("Using instructor ID:", instructorCanvasId);
      
      const response = await ky.get(`/api/canvas/assignments/${courseCanvasId}?instructorCanvasId=${instructorCanvasId}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      }).json();
      
      setAssignments(response);
      console.log("Assignments fetched:", response);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      setMessage("Error fetching assignments: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Fetch assignments for a specific student
  const fetchStudentAssignments = async () => {
    if (!studentCanvasId) {
      setMessage("Please enter a student Canvas ID");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await ky.get(`/api/canvas/assignments/${courseCanvasId}/student/${studentCanvasId}?instructorCanvasId=${instructorCanvasId}`, {
        credentials: "include",
        headers: getAuthHeaders(),
      }).json();
      
      setAssignments(response);
      console.log("Student assignments fetched:", response);
    } catch (error) {
      console.error("Error fetching student assignments:", error);
      setMessage("Error fetching student assignments: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  // Update assignment due date for a student
  const updateDueDate = async () => {
    if (!selectedAssignment || !studentCanvasId || !newDueDate) {
      setMessage("Please select an assignment, enter student ID, and new due date");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const response = await ky.put(`/api/canvas/assignments/${courseCanvasId}/${selectedAssignment.id}/due-date`, {
        json: {
          studentCanvasId,
          newDueDate,
          instructorCanvasId
        },
        credentials: "include",
        headers: getAuthHeaders(),
      }).json();
      
      setMessage("Due date updated successfully!");
      console.log("Due date updated:", response);
      
      // Clear form
      setSelectedAssignment(null);
      setNewDueDate("");
    } catch (error) {
      console.error("Error updating due date:", error);
      setMessage("Error updating due date: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Canvas Assignment Manager</h2>
        <p className="text-sm text-muted-foreground">
          Manage assignments and due dates for students using Canvas API
        </p>
      </div>

      {/* Course Assignments Section */}
      <Card>
        <CardHeader>
          <CardTitle>Course Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={fetchAssignments} disabled={loading} className="mb-4">
            {loading ? "Loading..." : "Fetch All Course Assignments"}
          </Button>
          
          {assignments.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">Assignments ({assignments.length})</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="p-3 border rounded-lg">
                    <div className="font-medium">{assignment.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Due: {assignment.due_at ? new Date(assignment.due_at).toLocaleString() : "No due date"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Group: {assignment.assignment_group_name || "No group"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ID: {assignment.id}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Assignments Section */}
      <Card>
        <CardHeader>
          <CardTitle>Student Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="studentCanvasId">Student Canvas ID</Label>
              <Input
                id="studentCanvasId"
                value={studentCanvasId}
                onChange={(e) => setStudentCanvasId(e.target.value)}
                placeholder="Enter student Canvas ID"
              />
            </div>
            <Button onClick={fetchStudentAssignments} disabled={loading || !studentCanvasId}>
              {loading ? "Loading..." : "Fetch Student Assignments"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Due Date Section */}
      <Card>
        <CardHeader>
          <CardTitle>Update Assignment Due Date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="assignmentSelect">Select Assignment</Label>
              <select
                id="assignmentSelect"
                value={selectedAssignment?.id || ""}
                onChange={(e) => {
                  const assignment = assignments.find(a => a.id.toString() === e.target.value);
                  setSelectedAssignment(assignment);
                }}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Choose an assignment...</option>
                {assignments.map((assignment) => (
                  <option key={assignment.id} value={assignment.id}>
                    {assignment.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <Label htmlFor="newDueDate">New Due Date</Label>
              <Input
                id="newDueDate"
                type="datetime-local"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
              />
            </div>
            
            <Button 
              onClick={updateDueDate} 
              disabled={loading || !selectedAssignment || !studentCanvasId || !newDueDate}
            >
              {loading ? "Updating..." : "Update Due Date"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Message Display */}
      {message && (
        <Card>
          <CardContent className="pt-6">
            <div className={`p-3 rounded-lg ${
              message.includes("Error") ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
            }`}>
              {message}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 