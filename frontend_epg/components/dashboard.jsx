import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PassUsageHistoryTable } from "./passUsageHistoryTable"

const pass_info = [
    {
        title: "24 Hour Pass",
        quantity: 5,
    },
    {
        title: "Exam Pass",
        quantity: 2,
    },
]

export function Dashboard() {
    return (
        <>
            <h1 className="text-l font-bold">Free Passes Remaining</h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                {pass_info.map((pass) => (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{pass.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{pass.quantity}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <h1 className="text-m font-bold">Free Passes Usage History</h1>
            <PassUsageHistoryTable />
        
        </>
    )
}

