import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function DataTable({
    columns,
    data,
    loading = false,
    emptyMessage = "No records found",
    footerRow = null,
    onRowClick = null,
    paginate = true,
    pageSize = 10,
    rowClassName = null,
}) {
    const [page, setPage] = useState(0);

    const total = data.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const dataSignature = useMemo(
        () => data.map((row, i) => row.id ?? i).join(","),
        [data]
    );

    useEffect(() => {
        setPage(0);
    }, [dataSignature]);

    const pageRows = paginate ? data.slice(page * pageSize, page * pageSize + pageSize) : data;

    const showPager = paginate && !loading && total > 0 && totalPages > 1;
    const rangeStart = total === 0 ? 0 : page * pageSize + 1;
    const rangeEnd = Math.min((page + 1) * pageSize, total);

    return (
        <div>
            <div className="overflow-x-auto">
                <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
                <thead>
                    <tr className="bg-slate-700 text-white">
                        {columns.map((column) => (
                            <th
                                key={column.key}
                                className={`px-4 py-3 font-semibold ${column.align === "right" ? "text-right" : "text-left"}`}
                            >
                                {column.header}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={columns.length} className="text-center py-16 text-slate-500">
                                Loading...
                            </td>
                        </tr>
                    ) : data.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="text-center py-16 text-slate-500">
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        pageRows.map((row, index) => {
                            if (row.is_section_header) {
                                return (
                                    <tr key={row.id ?? `section-${index}`} className="bg-slate-200">
                                        <td
                                            colSpan={columns.length}
                                            className="px-4 py-2.5 font-bold text-slate-800"
                                        >
                                            {row.label ?? row.section}
                                        </td>
                                    </tr>
                                );
                            }
                            const custom = rowClassName ? rowClassName(row) : "";
                            const zebra = custom.includes("bg-")
                                ? ""
                                : (index % 2 === 0 ? "bg-white" : "bg-slate-50");
                            return (
                                <tr
                                    key={row.id ?? index}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={`
                                        ${zebra}
                                        ${custom}
                                        border-b border-slate-100
                                        hover:bg-slate-100 transition-colors
                                        ${onRowClick ? "cursor-pointer" : ""}
                                    `}
                                >
                                    {columns.map((column) => (
                                        <td
                                            key={column.key}
                                            className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}
                                            onClick={column.stopRowClick ? (e) => e.stopPropagation() : undefined}
                                        >
                                            {column.render ? column.render(row) : row[column.key]}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })
                    )}
                    {footerRow && !loading && data.length > 0 && (
                        <tr className="bg-slate-100 font-semibold border-t-2 border-slate-300">
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}
                                >
                                    {column.render ? column.render(footerRow) : footerRow[column.key]}
                                </td>
                            ))}
                        </tr>
                    )}
                </tbody>
                </table>
            </div>

            {showPager && (
                <div className="flex items-center justify-between px-4 py-3 bg-white rounded-b-xl border-t border-slate-100 text-sm text-slate-500">
                    <span>
                        Showing {rangeStart}-{rangeEnd} of {total}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span>
                            Page {page + 1} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={page + 1 >= totalPages}
                            className="p-1.5 rounded-md border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}