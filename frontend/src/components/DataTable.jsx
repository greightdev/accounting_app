export default function DataTable({
    columns,
    data,
    loading = false,
    emptyMessage = "No records found",
    footerRow = null,
    onRowClick = null,
}) {
    return (
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
                    data.map((row, index) => (
                        <tr
                            key={row.id ?? index}
                            onClick={onRowClick ? () => onRowClick(row) : undefined}
                            className={`
                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
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
                    ))
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
    );
}