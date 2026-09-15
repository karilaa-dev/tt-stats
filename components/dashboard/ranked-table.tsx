import { T, useTranslation } from "@/lib/i18n/provider"
import { useMemo } from "react"
import { ListFilterIcon } from "lucide-react"
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
} from "@/components/controls"
import { Badge } from "@/components/controls"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/controls"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/controls"
import type { RankedValue } from "@/lib/stats/types"
import { cn } from "@/lib/utils"

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
  renderValue,
}: {
  rows: RankedValue[]
  valueLabel: string
  countLabel?: string
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  renderValue?: (value: string) => React.ReactNode
}) {
  const { locale } = useTranslation()

  const { t } = useTranslation()

  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor("value", {
          header: valueLabel,
          cell: ({ getValue, row }) => (
            <div className="flex min-w-0 items-center gap-3">
              <Badge
                variant="outline"
                className="w-8 shrink-0 justify-center tabular-nums"
              >
                <T>{row.index + 1}</T>
              </Badge>
              <span className="min-w-0 break-all whitespace-normal">
                {renderValue ? renderValue(getValue()) : getValue()}
              </span>
            </div>
          ),
        }),
        columnHelper.accessor("count", {
          header: countLabel,
          cell: ({ getValue }) => BigInt(getValue()).toLocaleString(locale),
        }),
      ]),
    [countLabel, renderValue, valueLabel, locale]
  )
  const effectivePageSize = Math.max(1, pageSize ?? rows.length)
  const lastPageIndex = Math.max(
    0,
    Math.ceil(rows.length / effectivePageSize) - 1
  )
  const pagination = {
    pageIndex: Math.min(lastPageIndex, Math.max(0, page - 1)),
    pageSize: effectivePageSize,
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

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListFilterIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>
            <T>{"No results for this period"}</T>
          </EmptyTitle>
          <EmptyDescription>
            <T>
              {
                "Choose a longer period or a different chat scope to find activity."
              }
            </T>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Table
        aria-label={t(`${valueLabel} ranked by ${countLabel.toLowerCase()}`)}
      >
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    header.column.id === "count" && "w-24 text-right"
                  )}
                >
                  <T>
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </T>
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
                  className={cn(
                    cell.column.id === "count" &&
                      "text-right font-medium tabular-nums",
                    cell.column.id !== "count" && !renderValue && "font-mono"
                  )}
                >
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pageSize && totalPages > 1 ? (
        <Pagination aria-label={t(`${valueLabel} pagination`)}>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={!table.getCanPreviousPage()}
                tabIndex={table.getCanPreviousPage() ? 0 : -1}
                className={cn(
                  !table.getCanPreviousPage() &&
                    "pointer-events-none opacity-50"
                )}
                onClick={(event) => {
                  event.preventDefault()
                  if (table.getCanPreviousPage()) table.previousPage()
                }}
              />
            </PaginationItem>
            <PaginationItem>
              <span
                className="px-3 text-sm text-muted-foreground"
                aria-live="polite"
                aria-atomic="true"
              >
                <T>{"Page "}</T>
                <T>{pagination.pageIndex + 1}</T>
                <T>{" of "}</T>
                <T>{totalPages}</T>
              </span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={!table.getCanNextPage()}
                tabIndex={table.getCanNextPage() ? 0 : -1}
                className={cn(
                  !table.getCanNextPage() && "pointer-events-none opacity-50"
                )}
                onClick={(event) => {
                  event.preventDefault()
                  if (table.getCanNextPage()) table.nextPage()
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  )
}
