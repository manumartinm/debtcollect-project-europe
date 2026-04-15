import { useMemo } from "react"
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"

import { Button } from "@workspace/ui/components/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

type Payment = {
  id: string
  email: string
  status: "pending" | "processing" | "success" | "failed"
  amount: number
}

export default function HomePage() {
  const data = useMemo<Payment[]>(
    () => [
      {
        id: "728ed52f",
        email: "m@example.com",
        status: "pending",
        amount: 100,
      },
      {
        id: "489e1d42",
        email: "example@gmail.com",
        status: "processing",
        amount: 125,
      },
      {
        id: "f31ce4dd",
        email: "hello@projecteurope.dev",
        status: "success",
        amount: 430,
      },
      {
        id: "8893ab91",
        email: "billing@company.io",
        status: "failed",
        amount: 78,
      },
    ],
    []
  )

  const columns = useMemo<ColumnDef<Payment>[]>(
    () => [
      {
        accessorKey: "status",
        header: "Status",
      },
      {
        accessorKey: "email",
        header: "Email",
      },
      {
        accessorKey: "amount",
        header: () => <div className="text-right">Amount</div>,
        cell: ({ row }) => {
          const amount = row.getValue<number>("amount")
          const formatted = new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
          }).format(amount)

          return <div className="text-right font-medium">{formatted}</div>
        },
      },
      {
        accessorKey: "id",
        header: "",
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigator.clipboard.writeText(row.original.id)}
            >
              Copy ID
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Recent payments</h1>
        <p className="text-sm text-muted-foreground">
          TanStack Table running with shared UI table primitives.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border">
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
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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

      <div className="font-mono text-xs text-muted-foreground">
        (Press <kbd>d</kbd> to toggle dark mode)
      </div>
    </div>
  )
}
