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

  export function AssignmentTable({ courseCanvasId, instructorCanvasId }) {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedGroups, setExpandedGroups] = useState({});
    const [showPublishedOnly, setShowPublishedOnly] = useState(false);

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

    // Filter assignments based on published status
    const filteredAssignments = showPublishedOnly 
      ? assignments.filter(assignment => assignment.published)
      : assignments;

    // Group assignments by assignment group
    const groupedAssignments = filteredAssignments.reduce((groups, assignment) => {
      const groupName = assignment.assignment_group_name || "Ungrouped";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(assignment);
      return groups;
    }, {});

    // Toggle group expansion
    const toggleGroup = (groupName) => {
      setExpandedGroups(prev => ({
        ...prev,
        [groupName]: !prev[groupName]
      }));
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
      <div className="space-y-6">
        {/* Statistics and Controls */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{stats.published}</div>
            <div className="text-xs text-gray-600">Published</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{stats.draft}</div>
            <div className="text-xs text-gray-600">Draft</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{stats.withDueDates}</div>
            <div className="text-xs text-gray-600">With Due Dates</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.totalPoints}</div>
            <div className="text-xs text-gray-600">Total Points</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={expandAll}
              className="text-xs"
            >
              Expand All
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={collapseAll}
              className="text-xs"
            >
              Collapse All
            </Button>
          </div>
          <Button 
            variant={showPublishedOnly ? "default" : "outline"}
            size="sm" 
            onClick={() => setShowPublishedOnly(!showPublishedOnly)}
            className="text-xs"
          >
            {showPublishedOnly ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
            {showPublishedOnly ? "Show All" : "Published Only"}
          </Button>
        </div>

        {/* Assignment Groups */}
        <div className="space-y-4">
          {Object.entries(groupedAssignments).map(([groupName, groupAssignments]) => (
            <Card key={groupName} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleGroup(groupName)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {expandedGroups[groupName] ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <BookOpen className="h-5 w-5" />
                    {groupName}
                    <span className="text-sm font-normal text-gray-500">
                      ({groupAssignments.length} assignments)
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{groupAssignments.filter(a => a.published).length} published</span>
                    <span>•</span>
                    <span>{groupAssignments.filter(a => a.due_at).length} with due dates</span>
                  </div>
                </div>
              </CardHeader>
              
              {expandedGroups[groupName] && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {groupAssignments.map((assignment) => (
                      <div 
                        key={assignment._id || assignment.id} 
                        className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-gray-900">{assignment.title || assignment.name}</h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                assignment.published ? 
                                  'bg-green-100 text-green-800' : 
                                  'bg-yellow-100 text-yellow-800'
                              }`}>
                                {assignment.published ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            {assignment.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {assignment.description.replace(/<[^>]*>/g, '')}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
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
                              <div className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                <span>{assignment.assignment_group_name || 'Ungrouped'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
        
        {/* Summary */}
        <div className="text-center text-sm text-gray-500 mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="font-medium">Summary</p>
          <p>Total assignments: {stats.total} • Groups: {Object.keys(groupedAssignments).length}</p>
          <p>Published: {stats.published} • Draft: {stats.draft} • Total points: {stats.totalPoints}</p>
        </div>
      </div>
    );
  }
  