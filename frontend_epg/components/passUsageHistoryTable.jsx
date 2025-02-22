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

  const used_passes = [
    {
        date_used: "2021-10-01",
        pass_type: "24 Hour Pass",
        assignment: "Lab 1",
    },
    {
        date_used: "2021-10-15",
        pass_type: "Quiz Retake Pass",
        assignment: "Quiz 2",
    },
    {
        date_used: "2021-11-01",
        pass_type: "24 Hour Pass",
        assignment: "Lab 3",
    }
  ]
  
  export function PassUsageHistoryTable() {
    return (
      <Table>
      <TableCaption>History</TableCaption>
      <TableHeader>
        <TableRow>
        <TableHead>Date Used</TableHead>
        <TableHead>Pass Type</TableHead>
        <TableHead>Assignment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {used_passes.map((pass, index) => (
        <TableRow key={index}>
          <TableCell className="font-medium">{pass.date_used}</TableCell>
          <TableCell>{pass.pass_type}</TableCell>
          <TableCell>{pass.assignment}</TableCell>
        </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
        <TableCell colSpan={3}>Total</TableCell>
        <TableCell className="text-right">{used_passes.length}</TableCell>
        </TableRow>
      </TableFooter>
      </Table>
    )
  }
  