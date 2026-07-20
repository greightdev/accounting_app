export default function DataTable({
    columns,
    data,
    loading = false,
    emptyMessage = "No records found",
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
                            className={`
                                ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                                border-b border-slate-100
                                hover:bg-slate-100 transition-colors
                            `}
                        >
                            {columns.map((column) => (
                                <td
                                    key={column.key}
                                    className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`}
                                >
                                    {column.render ? column.render(row) : row[column.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    );
}