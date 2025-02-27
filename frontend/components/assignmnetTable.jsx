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

  export function AssignmentTable({ courseCanvasId }) {
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
      async function fetchStudentInfo() {
        try {
          const assignments_for_course = await ky
            // .get(`/api/assignment/${courseCanvasId}`, {
            .get(`/api/assignment/course001`, {
              credentials: "include",
              headers: { Authorization: "Bearer " + getLtik() },
            })
            .json();
          setAssignments(assignments_for_course);
          console.log("Assignments:", assignments_for_course);
  
        } catch (error) {
          console.error("Error fetching student info:", error);
        }
      }
  
      fetchStudentInfo();
    }, []);


    return (
      <Table>
        <TableCaption>Assignments</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assignments.map((assignment) => (
            <TableRow key={assignment.title}>
              <TableCell className="font-medium">{assignment.title}</TableCell>
              <TableCell>{new Date(assignment.dueDate).toLocaleDateString()}</TableCell>
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
  