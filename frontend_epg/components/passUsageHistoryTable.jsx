import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PassUsageHistoryTable({ usedPasses }) {

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
        {usedPasses.map((pass, index) => (
          <TableRow key={index}>
            <TableCell className="font-medium">{pass.usedAt}</TableCell>
            <TableCell>{pass.type}</TableCell>
            <TableCell>{pass.assignmentId.title}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right">{usedPasses.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
