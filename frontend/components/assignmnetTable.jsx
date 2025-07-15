import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableFooter,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { getLtik } from "@/lib/ltik";
import { useEffect, useState } from "react"
import ky from "ky"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Calendar, FileText, ChevronDown, ChevronRight, Clock, Award, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AssignmentAnalytics } from "./assignmentAnalytics";

  export function AssignmentTable({ courseCanvasId, instructorCanvasId }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [showPublishedOnly, setShowPublishedOnly] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

    useEffect(() => {
      async function fetchAssignments() {
        if (!instructorCanvasId) {
          setLoading(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);
          const assignments_data = await ky
            .post(`/api/assignment/sync/${courseCanvasId}`, {
              json: { instructorCanvasId },
              credentials: "include",
              headers: { Authorization: "Bearer " + getLtik() },
            })
            .json();
          setAssignments(assignments_data);
          console.log("Synced Assignments (Instructor):", assignments_data);
        } catch (error) {
          console.error("Error syncing assignments:", error);
          setError("Failed to fetch assignments from backend");
        } finally {
          setLoading(false);
        }
      }
  
      fetchAssignments();
    }, [courseCanvasId, instructorCanvasId]);

    const handleAssignmentClick = (assignment) => {
      setSelectedAssignment(assignment);
      setIsAnalyticsOpen(true);
    };

    // Filter assignments based on published status
    const filteredAssignments = showPublishedOnly 
      ? assignments.filter(assignment => assignment.published)
      : assignments;

    // Group assignments by assignment group
    const groupedAssignments = filteredAssignments.reduce((acc, assignment) => {
      const groupName = assignment.assignment_group_name || "Uncategorized";
      if (!acc[groupName]) {
        acc[groupName] = [];
      }
      acc[groupName].push(assignment);
      return acc;
    }, {});

    // Toggle group expansion
    const toggleGroup = (groupName) => {
      setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    };

    // Expand all groups
    const expandAll = () => {
      const allExpanded = {};
      Object.keys(groupedAssignments).forEach(groupName => {
        allExpanded[groupName] = true;
      });
      setExpandedGroups(allExpanded);
    };

    // Collapse all groups
    const collapseAll = () => {
      setExpandedGroups({});
    };

    // Get assignment statistics
    const getAssignmentStats = () => {
      const total = assignments.length;
      const published = assignments.filter(a => a.published).length;
      const draft = total - published;
      const withDueDates = assignments.filter(a => a.due_at).length;
      const totalPoints = assignments.reduce((sum, a) => sum + (a.points_possible || 0), 0);
      
      return { total, published, draft, withDueDates, totalPoints };
    };

    const stats = getAssignmentStats();

    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading assignments...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-8 text-red-600">
          <p>{error}</p>
          <p className="text-sm text-gray-500 mt-1">Make sure your Canvas API key is configured</p>
        </div>
      );
    }

    if (assignments.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2" />
          <p>No assignments found</p>
        </div>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Assignments</h3>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setShowPublishedOnly(!showPublishedOnly)}>
              <Eye className="mr-2 h-4 w-4" />
              {showPublishedOnly ? "Show All" : "Show Published Only"}
            </Button>
          </div>
        </div>
        
        {loading && <p>Loading assignments...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {!loading && !error && Object.keys(groupedAssignments).length === 0 && (
          <p>No assignments found.</p>
        )}

        <div className="space-y-4">
          {Object.entries(groupedAssignments).map(([groupName, assignmentsInGroup]) => (
            <Card key={groupName}>
              <CardHeader 
                className="cursor-pointer flex flex-row items-center justify-between"
                onClick={() => toggleGroup(groupName)}
              >
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  {groupName}
                </CardTitle>
                {expandedGroups[groupName] ? <ChevronDown /> : <ChevronRight />}
              </CardHeader>
              {expandedGroups[groupName] && (
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Points</TableHead>
                        <TableHead>Published</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignmentsInGroup.map((assignment) => (
                        <TableRow 
                          key={assignment._id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => handleAssignmentClick(assignment)}
                        >
                          <TableCell className="font-medium">{assignment.title}</TableCell>
                          <TableCell>
                            {assignment.dueDate ? new Date(assignment.dueDate).toLocaleString() : "N/A"}
                          </TableCell>
                          <TableCell>{assignment.points_possible || "N/A"}</TableCell>
                          <TableCell>
                            {assignment.published ? "Yes" : "No"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                Analytics for: {selectedAssignment?.title}
              </DialogTitle>
            </DialogHeader>
            {selectedAssignment && (
              <AssignmentAnalytics 
                assignment={selectedAssignment} 
                courseCanvasId={courseCanvasId}
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }
  