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
import { ArrowUpDown, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
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
  DialogClose,
} from "@/components/ui/dialog";
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
  
  // fetch all students
  React.useEffect(() => {
    async function fetchStudents() {
      try {
        // const students = await ky.get(`/api/enrollment/${courseCanvasId}`, {
          const students = await ky.get(`/api/enrollment/course001`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          }).json();
          console.log("Students:", students);
          setStudents(students);
          
          // Get all pass types
          const passTypes = students.reduce((acc, student) => {
            const types = Object.keys(student.passesLeft);
            return [...acc, ...types];
          }
          , []);
          setPassTypes([...new Set(passTypes)]);
          
        } catch (error) {
          console.error("Error fetching students:", error);
        }
      }
      fetchStudents()
    }, []);
    
    const columns = [
      {
        id: "firstName",
        accessorFn: (row) => row.studentId.firstName,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            First Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("firstName")}</div>,
      },
      {
        id: "lastName",
        accessorFn: (row) => row.studentId.lastName,
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => <div className="font-medium">{row.getValue("lastName")}</div>,
      },
      {
        id: "email",
        accessorFn: (row) => row.studentId.email,
        header: () => <div className="text-right">Email</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium">{row.getValue("email")}</div>
        ),
      },
      ...passTypes.map((type) => ({
        id: type.toLowerCase(),
        accessorFn: (row) => row.passesLeft[type],
        header: () => <div className="text-right">{type.replace("_", " ")}</div>,
        cell: ({ row }) => (
          <div className="text-right font-medium">{row.getValue(type.toLowerCase())}</div>
        ),
      })),
    ];

  const handleRowClick = (student) => {
    setSelectedStudent(student);
  };

  const closeModal = () => {
    setSelectedStudent(null);
  };

  const table = useReactTable({
    data: students,
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

  return (
    <div className="w-full">
      <div className="flex items-center py-4">
        <Input
          placeholder="Filter First Name..."
          value={table.getColumn("firstName")?.getFilterValue() ?? ""}
          onChange={(event) =>
            table.getColumn("firstName")?.setFilterValue(event.target.value)
          }
          className="max-w-sm"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto">
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
                  onClick={() => handleRowClick(row.original)}
                  className="cursor-pointer hover:bg-muted/50"
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
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
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
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={closeModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedStudent.studentId.firstName} {selectedStudent.studentId.lastName}
              </DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <p>Email: {selectedStudent.studentId.email}</p>
                  <p>Canvas ID: {selectedStudent.studentId.canvasId}</p>
                  <p>Extension Passes Left: {selectedStudent.passesLeft.EXTENSION_24H}</p>
                  <p>Quiz Retakes Left: {selectedStudent.passesLeft.QUIZ_RETAKE}</p>
                  {selectedStudent.freePasses.length > 0 && (
                    <div>
                      <p className="font-medium">Used Passes:</p>
                      <ul className="list-disc pl-4">
                        {selectedStudent.freePasses.map((pass, index) => (
                          <li key={pass._id}>
                            {pass.type} used on {new Date(pass.usedAt).toLocaleDateString()} for {pass.assignmentId.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}