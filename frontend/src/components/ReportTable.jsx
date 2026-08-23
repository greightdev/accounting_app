import { useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import DataTable from "./DataTable";
import NepaliDateInput from "./NepaliDateInput";

export default function ReportTable({
    title,
    columns,
    data = [],
    loading = false,
    dateMode = "range",
    showDateFilter = true,
    onDateFilterChange,
    footerRow = null,
    filterContent = null,
    rowClassName = null,
}) {
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [asOf, setAsOf] = useState("");

    const applyFilter = () => {
        if (dateMode === "asOf") {
            onDateFilterChange?.({ asOf: asOf || null });
        } else {
            onDateFilterChange?.({ from: dateFrom || null, to: dateTo || null });
        }
    }

    const exportToExcel = () => {
        const rows = data.map((row) =>
            Object.fromEntries(columns.map((col) => [col.header, row[col.key]]))
        );
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31)); // sheet name max 31 chars
        XLSX.writeFile(wb, `${title.replace(/\s+/g, "_")}.xlsx`);
    };

    const exportToPdf = () => {
        const win = window.open("", "_blank");
        const rowsHtml = data
            .map(
                (row) =>
                    `<tr>${columns
                        .map((col) => `<td style="padding:6px 10px;border-bottom:1px solid #eee;">${col.render ? col.render(row) : row[col.key] ?? ""}</td>`)
                        .join("")}</tr>`
            )
            .join("");
        const headHtml = columns.map((col) => `<th style="text-align:left;padding:6px 10px;background:#334155;color:#fff;">${col.header}</th>`).join("");

        win.document.write(`
            <html>
                <head><title>${title}</title></head>
                <body style="font-family:sans-serif;">
                    <h2>${title}</h2>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead><tr>${headHtml}</tr></thead>
                        <tbody>${rowsHtml}</tbody>
                    </table>
                    <script>window.onload = () => window.print();</script>
                </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <div className="bg-white rounded-lg shadow">
            <div className="flex items-center justify-end gap-1.5 px-4 py-2.5 border-b border-gray-100">

                <div className="flex items-center gap-3">
                    {filterContent}
                    
                    {dateMode === "range" && (
                        <>
                            <NepaliDateInput
                                compact
                                value={dateFrom}
                                disableFuture
                                onChange={setDateFrom}
                            />
                            <span className="text-gray-400 text-sm">to</span>
                            <NepaliDateInput
                                compact
                                value={dateTo}
                                disableFuture
                                onChange={setDateTo}
                            />
                            <button
                                onClick={applyFilter}
                                className="px-3 py-1.5 rounded-md bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition"
                            >
                                Apply
                            </button>
                        </>
                    )}

                    {dateMode === "asOf" && (
                        <>
                            <span className="text-gray-500 text-sm">As of</span>
                            <NepaliDateInput
                                compact
                                value={asOf}
                                disableFuture
                                onChange={setAsOf}
                            />
                            <button
                                onClick={applyFilter}
                                className="px-3 py-1.5 rounded-md bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition"
                            >
                                Apply
                            </button>
                        </>
                    )}

                    <button
                        onClick={exportToExcel}
                        title="Export to Excel"
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition"
                    >
                        <FileSpreadsheet size={18} />
                    </button>
                    <button
                        onClick={exportToPdf}
                        title="Export to PDF"
                        className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition"
                    >
                        <Download size={18} />
                    </button>
                </div>
            </div>

            <DataTable columns={columns} data={data} loading={loading} footerRow={footerRow} rowClassName={rowClassName} paginate={false} />
        </div>
    );
}