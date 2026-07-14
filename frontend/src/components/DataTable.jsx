export default function DataTable({ columns, data }) {
    return (
        <table className="w-full overflow-hidden rounded-xl bg-white shadow-sm">
            <thead>
                <tr className="bg-slate-700 text-white">
                    {columns.map((column) => (
                        <th
                            key={column.key}
                            className="px-4 py-3 text-left font-semibold"
                        >
                            {column.header}
                        </th>
                    ))}
                </tr>
            </thead>

            <tbody>
                {data.map((row, index) => (
                    <tr
                        key={row.id}
                        className={`
                            ${index % 2 === 0 ? "bg-white" : "bg-slate-50"}
                            border-b border-slate-100
                            hover:bg-slate-100 transition-colors
                        `}
                    >
                        {columns.map((column) => (
                            <td key={column.key} className="px-4 py-3">
                                {column.render
                                    ? column.render(row)
                                    : row[column.key]}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}