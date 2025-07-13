"use client";

import * as React from "react";
import {
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { 
  ArrowUpDown, 
  ChevronDown, 
  Users, 
  Award, 
  Clock, 
  Calendar,
  Mail,
  Phone,
  Eye,
  Edit,
  Plus,
  Search,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  User,
  Activity,
  BookOpen,
  Target
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getLtik } from "@/lib/ltik";
import ky from "ky";

export function StudentTable({ courseCanvasId }) {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [selectedStudent, setSelectedStudent] = React.useState(null);
  const [students, setStudents] = React.useState([]);
  const [passTypes, setPassTypes] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({
    totalStudents: 0,
    activeStudents: 0,
    totalPassesUsed: 0,
    averagePassesPerStudent: 0,
    passUsageByType: {},
    recentActivity: []
  });
  const [viewMode, setViewMode] = React.useState("table"); // table, cards, analytics
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterStatus, setFilterStatus] = React.useState("all"); // all, active, inactive, low-passes

  // Fetch all students and calculate statistics
  React.useEffect(() => {
    async function fetchStudents() {
      try {
        setLoading(true);
        console.log("Fetching students for course:", courseCanvasId);
        const students = await ky.get(`/api/enrollment/${courseCanvasId}`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        console.log("Students:", students);
        console.log("Course Canvas ID being used:", courseCanvasId);
        console.log("Number of students found:", students.length);
        setStudents(students);

        // Get pass types from the first student
        if (students.length > 0) {
          const firstStudentPassTypes = students[0].passesLeft.map(
            (pass) => pass.passId.name
          );
          setPassTypes(firstStudentPassTypes);
        }

        // Calculate statistics
        calculateStats(students);
      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStudents();
  }, [courseCanvasId]);

  const calculateStats = (studentData) => {
    const totalStudents = studentData.length;
    const totalPassesUsed = studentData.reduce((total, student) => {
      return total + student.freePasses.length;
    }, 0);

    const passUsageByType = {};
    studentData.forEach(student => {
      student.freePasses.forEach(pass => {
        const passName = pass.passId.name;
        passUsageByType[passName] = (passUsageByType[passName] || 0) + 1;
      });
    });

    const recentActivity = studentData
      .flatMap(student => 
        student.freePasses.map(pass => ({
          ...pass,
          studentName: `${student.studentId.firstName} ${student.studentId.lastName}`,
          studentEmail: student.studentId.email
        }))
      )
      .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
      .slice(0, 10);

    setStats({
      totalStudents,
      activeStudents: totalStudents, // Could be calculated based on last activity
      totalPassesUsed,
      averagePassesPerStudent: totalStudents > 0 ? (totalPassesUsed / totalStudents).toFixed(1) : 0,
      passUsageByType,
      recentActivity
    });
  };

  const columns = [
    {
      id: "select",
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          onChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          className="rounded border-gray-300"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          onChange={(value) => row.toggleSelected(!!value)}
          className="rounded border-gray-300"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      id: "student",
      accessorFn: (row) => `${row.studentId.firstName} ${row.studentId.lastName}`,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="font-semibold"
        >
          Student
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="font-medium">{row.getValue("student")}</div>
            <div className="text-sm text-gray-500">{row.original.studentId.email}</div>
          </div>
        </div>
      ),
    },
    {
      id: "canvasId",
      accessorFn: (row) => row.studentId.canvasId,
      header: "Canvas ID",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-mono text-xs">
          {row.getValue("canvasId")}
        </Badge>
      ),
    },
    ...passTypes.map((type) => ({
      id: type.toLowerCase().replace(/\s+/g, "-"),
      accessorFn: (row) => {
        const pass = row.passesLeft.find((pass) => pass.passId.name === type);
        return pass ? pass.count : 0;
      },
      header: () => (
        <div className="text-center">
          <div className="font-medium">{type}</div>
          <div className="text-xs text-gray-500">Remaining</div>
        </div>
      ),
      cell: ({ row }) => {
        const count = row.getValue(type.toLowerCase().replace(/\s+/g, "-"));
        return (
          <div className="text-center">
            <Badge 
              variant={count > 0 ? "default" : "destructive"}
              className="font-mono"
            >
              {count}
            </Badge>
          </div>
        );
      },
    })),
    {
      id: "passesUsed",
      accessorFn: (row) => row.freePasses.length,
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="font-semibold"
        >
          Passes Used
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="text-center">
          <Badge variant="secondary" className="font-mono">
            {row.getValue("passesUsed")}
          </Badge>
        </div>
      ),
    },
    {
      id: "lastActivity",
      accessorFn: (row) => {
        if (row.freePasses.length === 0) return null;
        const latestPass = row.freePasses.reduce((latest, pass) => 
          new Date(pass.usedAt) > new Date(latest.usedAt) ? pass : latest
        );
        return new Date(latestPass.usedAt);
      },
      header: "Last Activity",
      cell: ({ row }) => {
        const lastActivity = row.getValue("lastActivity");
        return lastActivity ? (
          <div className="text-sm text-gray-600">
            {lastActivity.toLocaleDateString()}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No activity</div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRowClick(row.original)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleRowClick(row.original)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Edit className="mr-2 h-4 w-4" />
                Edit Passes
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Send Message
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const handleRowClick = (student) => {
    setSelectedStudent(student);
  };

  const closeModal = () => {
    setSelectedStudent(null);
  };

  const filteredStudents = React.useMemo(() => {
    let filtered = students;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(student => 
        student.studentId.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus === "low-passes") {
      filtered = filtered.filter(student => 
        student.passesLeft.some(pass => pass.count <= 1)
      );
    }

    return filtered;
  }, [students, searchTerm, filterStatus]);

  const table = useReactTable({
    data: filteredStudents,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStudents}</div>
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
            <div className="text-2xl font-bold">{stats.totalPassesUsed}</div>
            <p className="text-xs text-muted-foreground">
              All time usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Passes/Student</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.averagePassesPerStudent}</div>
            <p className="text-xs text-muted-foreground">
              Average usage
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStudents}</div>
            <p className="text-xs text-muted-foreground">
              Recently active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilterStatus("all")}>
                All Students
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilterStatus("low-passes")}>
                Low Passes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-auto">
            <TabsList>
              <TabsTrigger value="table">Table</TabsTrigger>
              <TabsTrigger value="cards">Cards</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content based on view mode */}
      {viewMode === "table" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="hover:bg-muted/50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No students found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStudents.map((student) => (
            <Card key={student._id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {student.studentId.firstName} {student.studentId.lastName}
                      </CardTitle>
                      <p className="text-sm text-gray-500">{student.studentId.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRowClick(student)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Passes Used:</span>
                    <Badge variant="secondary">{student.freePasses.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {student.passesLeft.map((pass) => (
                      <div key={pass._id} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{pass.passId.name}:</span>
                        <Badge variant={pass.count > 0 ? "default" : "destructive"}>
                          {pass.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {viewMode === "analytics" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Pass Usage by Type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.passUsageByType).map(([passType, count]) => (
                  <div key={passType} className="flex justify-between items-center">
                    <span className="text-sm font-medium">{passType}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 5).map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.studentName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activity.passId.name} • {activity.assignmentId?.title || 'Unknown Assignment'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(activity.usedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pagination */}
      {viewMode === "table" && (
        <div className="flex items-center justify-between space-x-2 py-4">
          <div className="text-sm text-gray-700">
            Showing {table.getFilteredRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} results
          </div>
          <div className="space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={closeModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {selectedStudent.studentId.firstName} {selectedStudent.studentId.lastName}
              </DialogTitle>
              <DialogDescription>
                Detailed student information and pass usage history
              </DialogDescription>
            </DialogHeader>
            
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="passes">Passes</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm">{selectedStudent.studentId.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Canvas ID</label>
                    <p className="text-sm font-mono">{selectedStudent.studentId.canvasId}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-blue-600">
                        {selectedStudent.passesLeft.reduce((total, pass) => total + pass.count, 0)}
                      </div>
                      <p className="text-xs text-gray-500">Total Passes Left</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-green-600">
                        {selectedStudent.freePasses.length}
                      </div>
                      <p className="text-xs text-gray-500">Passes Used</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-2xl font-bold text-purple-600">
                        {selectedStudent.freePasses.length > 0 ? 
                          new Date(selectedStudent.freePasses[0].usedAt).toLocaleDateString() : 
                          'Never'
                        }
                      </div>
                      <p className="text-xs text-gray-500">Last Used</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="passes" className="space-y-4">
                <div className="space-y-3">
                  {selectedStudent.passesLeft.map((pass) => (
                    <div key={pass._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <h4 className="font-medium">{pass.passId.name}</h4>
                        <p className="text-sm text-gray-500">{pass.passId.description}</p>
                      </div>
                      <Badge variant={pass.count > 0 ? "default" : "destructive"} className="text-lg">
                        {pass.count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-4">
                {selectedStudent.freePasses.length > 0 ? (
                  <div className="space-y-3">
                    {selectedStudent.freePasses.map((pass, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 border rounded-lg">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{pass.passId.name}</p>
                          <p className="text-sm text-gray-500">
                            Used for: {pass.assignmentId?.title || 'Unknown Assignment'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(pass.usedAt).toLocaleDateString()} at {new Date(pass.usedAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="h-8 w-8 mx-auto mb-2" />
                    <p>No passes used yet</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <DialogFooter>
              <Button variant="outline" onClick={closeModal}>
                Close
              </Button>
              <Button>
                <Edit className="mr-2 h-4 w-4" />
                Edit Passes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
