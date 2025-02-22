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

  const assignments = [
    {
        title: "Assignment 1",
        due_date: "2021-10-01",
    },
    {
        title: "Assignment 2",
        due_date: "2021-10-15",
    },
    {
        title: "Assignment 3",
        due_date: "2021-11-01",
    },
    {
        title: "Assignment 4",
        due_date: "2021-11-15",
    },
    {
        title: "Assignment 5",
        due_date: "2021-12-01",
    },
    {
        title: "Assignment 6",
        due_date: "2021-12-15",
    },
    {
        title: "Assignment 7",
        due_date: "2022-01-01",
    },
  ]
  
  export function AssignmentTable() {
    return (
      <Table>
        <TableCaption>Assignments</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.title}>
              <TableCell className="font-medium">{assignment.title}</TableCell>
              <TableCell>{assignment.due_date}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">{assignments.length}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
  }
  