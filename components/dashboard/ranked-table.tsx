import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RankedValue } from "@/lib/stats/types"

export function RankedTable({
  rows,
  valueLabel,
  countLabel = "Count",
}: {
  rows: RankedValue[]
  valueLabel: string
  countLabel?: string
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{valueLabel}</TableHead>
          <TableHead className="text-right">{countLabel}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.value}>
            <TableCell className="font-mono">{row.value}</TableCell>
            <TableCell className="text-right tabular-nums">
              {BigInt(row.count).toLocaleString("en-US")}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
