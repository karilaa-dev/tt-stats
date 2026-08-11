import { useMemo } from "react"
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RankedValue } from "@/lib/stats/types"

const features = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
})
const columnHelper = createColumnHelper<typeof features, RankedValue>()

export function RankedTable({
  rows,
  valueLabel,
  countLabel = "Count",
  page = 1,
  pageSize,
  onPageChange,
}: {
  rows: RankedValue[]
  valueLabel: string
  countLabel?: string
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
}) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("value", {
          header: valueLabel,
          cell: ({ getValue }) => getValue(),
        }),
        columnHelper.accessor("count", {
          header: countLabel,
          cell: ({ getValue }) =>
            BigInt(getValue()).toLocaleString("en-US"),
        }),
      ]),
    [countLabel, valueLabel]
  )
  const pagination = {
    pageIndex: Math.max(0, page - 1),
    pageSize: pageSize ?? Math.max(1, rows.length),
  }
  const table = useTable(
    {
      features,
      columns,
      data: rows,
      state: { pagination },
      onPaginationChange: (updater) => {
        const next =
          typeof updater === "function" ? updater(pagination) : updater
        onPageChange?.(next.pageIndex + 1)
      },
    },
    (state) => ({ pagination: state.pagination })
  )
  const totalPages = table.getPageCount()

  return (
    <div className="flex flex-col gap-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={header.column.id === "count" ? "text-right" : undefined}
                >
                  {header.isPlaceholder ? null : (
                    <table.FlexRender header={header} />
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getPaginatedRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={
                    cell.column.id === "count"
                      ? "text-right tabular-nums"
                      : "font-mono"
                  }
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageSize && totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={!table.getCanPreviousPage()}
                className={
                  table.getCanPreviousPage()
                    ? undefined
                    : "pointer-events-none opacity-50"
                }
                onClick={(event) => {
                  event.preventDefault()
                  table.previousPage()
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span className="px-3 text-sm text-muted-foreground">
                Page {pagination.pageIndex + 1} of {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={!table.getCanNextPage()}
                className={
                  table.getCanNextPage()
                    ? undefined
                    : "pointer-events-none opacity-50"
                }
                onClick={(event) => {
                  event.preventDefault()
                  table.nextPage()
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
