import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/axios";
import ReportTable from "../components/ReportTable";
import { REPORT_REGISTRY } from "../reports";

export default function ReportViewer() {
    const { reportKey } = useParams();
    const navigate = useNavigate();
    const report = REPORT_REGISTRY[reportKey];

    const [data, setData] = useState([]);
    const [meta, setMeta] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dateFilter, setDateFilter] = useState({ from: null, to: null, asOf: null });

    const [extraFilterValues, setExtraFilterValues] = useState({});
    const [extraFilterOptions, setExtraFilterOptions] = useState({});

    // Load dropdown options for any extra filters this report needs
    useEffect(() => {
        if (!report?.extraFilters) return;
        report.extraFilters.forEach(async (filter) => {
            try {
                const { data } = await api.get(filter.optionsEndpoint);
                const options = filter.optionsKey ? data[filter.optionsKey] : data.data;
                setExtraFilterOptions((prev) => ({ ...prev, [filter.key]: options ?? [] }));
            } catch (err) {
                console.log(err);
            }
        });
    }, [reportKey]);

    // Reset everything when switching reports
    useEffect(() => {
        setExtraFilterValues({});
        setData([]);
        setMeta(null);
    }, [reportKey]);

    useEffect(() => {
        if (!report) return;

        const missingRequiredFilter = (report.extraFilters ?? []).some(
            (f) => f.required && !extraFilterValues[f.key]
        );
        const missingRequiredDates =
            report.datesRequired &&
            (report.dateMode === "asOf" ? !dateFilter.asOf : (!dateFilter.from || !dateFilter.to));

        if (missingRequiredFilter || missingRequiredDates) {
            setData([]);
            setMeta(null);
            return;
        }

        fetchData();
    }, [reportKey, dateFilter, extraFilterValues]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (report.dateMode === "asOf") {
                if (dateFilter.asOf) params.set("as_of", dateFilter.asOf);
            } else if (report.dateMode !== "none") {
                if (dateFilter.from) params.set("date_from", dateFilter.from);
                if (dateFilter.to) params.set("date_to", dateFilter.to);
            }

            Object.entries(extraFilterValues).forEach(([key, value]) => {
                if (value) params.set(key, value);
            });

            const { data } = await api.get(`${report.endpoint}?${params.toString()}`);
            setData(data.data ?? []);
            setMeta(data.meta ?? null);
        } catch (err) {
            console.error(`Failed to fetch ${reportKey}:`, err);
        } finally {
            setLoading(false);
        }
    };

    if (!report) {
        return (
            <div className="text-center py-20 text-slate-500">
                Report not found.
                <div className="mt-3">
                    <button onClick={() => navigate("/reports")} className="text-slate-700 underline">
                        Back to Reports
                    </button>
                </div>
            </div>
        );
    }

    // Generic footer-row builder
    const footerRow = report.footerMeta && meta
        ? {
            ...report.columns.reduce((acc, c) => ({ ...acc, [c.key]: "" }), {}),
            [report.footerLabelColumn ?? report.columns[0]?.key]: report.footerLabel ?? "Total",
            ...Object.fromEntries(
                Object.entries(report.footerMeta).map(([colKey, metaKey]) => [colKey, meta[metaKey]])
            ),
        }
        : null;

    const missingRequiredFilter = (report.extraFilters ?? []).some(
        (f) => f.required && !extraFilterValues[f.key]
    );

    const missingRequiredDates =
        report.datesRequired &&
        (report.dateMode === "asOf" ? !dateFilter.asOf : (!dateFilter.from || !dateFilter.to));
    const isBlocked = missingRequiredFilter || missingRequiredDates;

    const emptyMessage = missingRequiredFilter
        ? `Select ${report.extraFilters?.[0]?.label.toLowerCase()} to view this report.`
        : missingRequiredDates
        ? "Select a date range to view this report."
        : "No records found";

    // Selection
    const filterContent = (report.extraFilters ?? []).length > 0 ? (
        <>
            {report.extraFilters.map((filter) => 
                filter.type === "text" ? (
                    <input
                        key={filter.key}
                        type="text"
                        placeholder={filter.placeholder ?? filter.label}
                        value={extraFilterValues[filter.key] ?? ""}
                        onChange={(e) => setExtraFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))}
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white"
                    />
                ) : (
                    <select
                        key={filter.key}
                        value={extraFilterValues[filter.key] ?? ""}
                        onChange={(e) =>
                            setExtraFilterValues((prev) => ({ ...prev, [filter.key]: e.target.value }))
                        }
                        className="px-3 py-1.5 rounded-md border border-gray-200 text-sm bg-white"
                    >
                        <option value="">
                            {filter.required ? `Select ${filter.label.toLowerCase()}` : `All ${filter.label}s`}
                        </option>
                        {(extraFilterOptions[filter.key] ?? []).map((opt) => (
                            <option key={opt.id} value={opt.id}>
                                {opt.code ? `${opt.code} — ${opt.name}` : opt.name}
                            </option>
                        ))}
                    </select>
                )
            )}
        </>
    ) : null;

    return (
        <>
            <button
                onClick={() => navigate("/reports")}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-4 transition"
            >
                <ArrowLeft size={16} /> Back to Reports
            </button>

            {/* Summary bar */}
            {report.summaryFields && meta && !isBlocked && (
                <div className="bg-white rounded-lg shadow px-5 py-4 mb-4 flex items-center gap-8 text-sm">
                    {report.summaryFields.map((f) => {
                        const typeRaw = f.typeKey ? meta[f.typeKey] : null;
                        const typeLabel = f.typeMap ? f.typeMap[typeRaw] ?? typeRaw : typeRaw;
                        return (
                            <div key={f.key}>
                                <span className="text-gray-500">{f.label}: </span>
                                <span className="font-semibold">
                                    {Number(meta[f.key] || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {typeLabel}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}

            <ReportTable
                title={report.title}
                filterContent={filterContent}
                columns={report.columns}
                data={data}
                loading={loading && !isBlocked}
                emptyMessage={emptyMessage}
                dateMode={report.dateMode ?? "range"}
                onDateFilterChange={setDateFilter}
                footerRow={footerRow}
                rowClassName={report.rowClassName}
            />
            {meta?.is_balanced === false && (
                <p className="mt-3 text-sm text-red-600 font-medium">
                    Trial balance is unbalanced - debits and credits do not match.
                </p>
            )}
            {meta?.matches_calculation === false && (
                <p className="mt-3 text-sm text-red-600 font-medium">
                    VAT Return does not match ledger balances — VAT Payable/Receivable accounts may be out of sync.
                </p>
            )}
        </>
    );
}