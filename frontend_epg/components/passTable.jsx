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

  const passes = [
    {
        title: "24 Hour Pass",
        quantity: 5,
    },
    {
        title: "Exam Pass",
        quantity: 2,
    },
  ]
  
  export function PassTable() {
    return (
      <Table>
        <TableCaption>Passes</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Title</TableHead>
            <TableHead>Quantity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {passes.map((pass) => (
            <TableRow key={pass.title}>
              <TableCell className="font-medium">{pass.title}</TableCell>
              <TableCell>{pass.quantity}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          {/* <TableRow>
            <TableCell colSpan={3}>Total</TableCell>
            <TableCell className="text-right">$2,500.00</TableCell>
          </TableRow> */}
        </TableFooter>
      </Table>
    )
  }
  