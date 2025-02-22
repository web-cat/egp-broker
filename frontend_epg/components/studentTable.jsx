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
import { ArrowUpDown, ChevronDown, MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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

const students = [
  {
    id: "m5gr84i9",
    firstName: "Saketh",
    lastName: "Rajesh",
    email: "saketh@vt.edu",
  },
  { id: "3u1reuv4", firstName: "Bob", lastName: "Mill", email: "bob@vt.edu" },
  {
    id: "derv1ws0",
    firstName: "Sally",
    lastName: "Kumar",
    email: "sally@vt.edu",
  },
  { id: "5kma53ae", firstName: "John", lastName: "Doe", email: "john@vt.edu" },
  { id: "bhqecj4p", firstName: "Jane", lastName: "Doe", email: "jane@vt.edu" },
  { id: "1", firstName: "Alice", lastName: "Smith", email: "alice@vt.edu" },
  { id: "2", firstName: "Charlie", lastName: "Brown", email: "charlie@vt.edu" },
  { id: "3", firstName: "David", lastName: "Wilson", email: "david@vt.edu" },
  { id: "4", firstName: "Eve", lastName: "Davis", email: "eve@vt.edu" },
  { id: "5", firstName: "Frank", lastName: "Miller", email: "frank@vt.edu" },
  { id: "6", firstName: "Grace", lastName: "Lee", email: "grace@vt.edu" },
  { id: "7", firstName: "Hank", lastName: "Taylor", email: "hank@vt.edu" },
  { id: "8", firstName: "Ivy", lastName: "Anderson", email: "ivy@vt.edu" },
  { id: "9", firstName: "Jack", lastName: "Thomas", email: "jack@vt.edu" },
  { id: "10", firstName: "Karen", lastName: "Jackson", email: "karen@vt.edu" },
  { id: "11", firstName: "Leo", lastName: "White", email: "leo@vt.edu" },
  { id: "12", firstName: "Mia", lastName: "Harris", email: "mia@vt.edu" },
  { id: "13", firstName: "Nina", lastName: "Martin", email: "nina@vt.edu" },
  { id: "14", firstName: "Oscar", lastName: "Garcia", email: "oscar@vt.edu" },
  { id: "15", firstName: "Paul", lastName: "Martinez", email: "paul@vt.edu" },
  { id: "16", firstName: "Quinn", lastName: "Robinson", email: "quinn@vt.edu" },
  { id: "17", firstName: "Rachel", lastName: "Clark", email: "rachel@vt.edu" },
  { id: "18", firstName: "Sam", lastName: "Rodriguez", email: "sam@vt.edu" },
  { id: "19", firstName: "Tina", lastName: "Lewis", email: "tina@vt.edu" },
  { id: "20", firstName: "Uma", lastName: "Walker", email: "uma@vt.edu" },
];

export const columns = [
  {
    accessorKey: "firstName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        First Name
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="lowercase">{row.getValue("firstName")}</div>
    ),
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Last Name
        <ArrowUpDown />
      </Button>
    ),
    cell: ({ row }) => (
      <div className="lowercase">{row.getValue("lastName")}</div>
    ),
  },
  {
    accessorKey: "email",
    header: () => <div className="text-right">Email</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">{row.getValue("email")}</div>
    ),
  },
  // {
  //   id: "actions",
  //   enableHiding: false,
  //   cell: ({ row }) => {
  //     const student = row.original;
  //     return (
  //       <DropdownMenu>
  //         <DropdownMenuTrigger asChild>
  //           <Button variant="ghost" className="h-8 w-8 p-0">
  //             <span className="sr-only">Open menu</span>
  //             <MoreHorizontal />
  //           </Button>
  //         </DropdownMenuTrigger>
  //         <DropdownMenuContent align="end">
  //           <DropdownMenuLabel>Actions</DropdownMenuLabel>
  //           <DropdownMenuItem
  //             onClick={() => navigator.clipboard.writeText(student.id)}
  //           >
  //             Copy student ID
  //           </DropdownMenuItem>
  //           <DropdownMenuSeparator />
  //           <DropdownMenuItem>View profile</DropdownMenuItem>
  //           <DropdownMenuItem>Send email</DropdownMenuItem>
  //         </DropdownMenuContent>
  //       </DropdownMenu>
  //     );
  //   },
  // },
];

export function StudentTable() {
  const [sorting, setSorting] = React.useState([]);
  const [columnFilters, setColumnFilters] = React.useState([]);
  const [columnVisibility, setColumnVisibility] = React.useState({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [selectedStudent, setSelectedStudent] = React.useState(null);
  const [studentInfo, setStudentInfo] = React.useState(null);

  const handleRowClick = (student) => {
    setSelectedStudent(student);
  };

  const closeModal = () => {
    setSelectedStudent(null);
    setStudentInfo(null);
  };

  // Fetch more student info when a student is selected
  useEffect(() => {
    async function fetchStudentInfo(selectedStudent) {
      if (selectedStudent) {
        const studentData = await ky
          .get(`/api/student/${selectedStudent.id}`, {
            credentials: "include",
            headers: { Authorization: "Bearer " + getLtik() },
          })
          .json();
        setStudentInfo(studentData);
      }
    }
    fetchStudentInfo(selectedStudent);
  }, [selectedStudent]);

  // fetch all students
  // useEffect(() => {
  //   fetch("https://dummyapi.io/data/api/user", {
  //     headers: { "app-id": "dummyappid" }
  //   })
  //     .then(response => response.json())
  //     .then(data => console.log(data));
  // }, []);

  const router = useRouter();

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
              Columns <ChevronDown />
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
                  className="cursor-pointer"
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
        {/* <div className="flex-1 text-sm text-muted-foreground">
            Showing {table.getRows().length} of {students.length} students
        </div> */}
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
                {selectedStudent.firstName} {selectedStudent.lastName}
              </DialogTitle>
              <DialogDescription>
                {studentInfo ? (
                  <>
                    <p>Email: {studentInfo.email}</p>
                    <p>Phone: {studentInfo.phone}</p>
                    <p>
                      Address: {studentInfo.location.street},{" "}
                      {studentInfo.location.city}
                    </p>
                    {/* Add more student details here */}
                  </>
                ) : (
                  <p>Loading...</p>
                )}
              </DialogDescription>
              <DialogClose asChild>
                <Button variant="ghost" onClick={closeModal}>
                  Close
                </Button>
              </DialogClose>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
