import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import NepaliDate, { dateConfigMap } from "nepali-date-converter";

NepaliDate.language = "np";

const MONTHS_NP = ["बैशाख", "जेठ", "असार", "श्रावण", "भाद्र", "आश्विन", "कार्तिक", "मंसिर", "पौष", "माघ", "फाल्गुण", "चैत्र"];
// dateConfigMap is keyed by these English month names regardless of NepaliDate.language.
const MONTHS_EN_KEYS = ["Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Aswin", "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra"];
// Single/double-letter Nepali weekday initials (आइतबार..शनिबार), matching the reference design.
const WEEKDAYS_NP_SHORT = ["आ", "सो", "मं", "बु", "बि", "शु", "श"];
const DEVANAGARI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

function toDevanagari(num) {
    return String(num).split("").map((ch) => DEVANAGARI_DIGITS[Number(ch)] ?? ch).join("");
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

// AD 'YYYY-MM-DD' -> NepaliDate. Appending T00:00:00 keeps this in local time;
// a bare date-only string parses as UTC per spec and can shift a day in some timezones.
function adStringToBs(adString) {
    if (!adString) return null;
    const d = new Date(`${adString}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return new NepaliDate(d);
}

// NepaliDate -> AD 'YYYY-MM-DD', using local-time getters to avoid the same UTC shift.
function bsToAdString(bsDate) {
    const jsDate = bsDate.toJsDate();
    const y = jsDate.getFullYear();
    const m = String(jsDate.getMonth() + 1).padStart(2, "0");
    const d = String(jsDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// BS date -> "2083/05/07" (plain digits, zero-padded).
function formatBsSlash(bsDate) {
    return `${bsDate.getYear()}/${pad2(bsDate.getMonth() + 1)}/${pad2(bsDate.getDate())}`;
}

function daysInBsMonth(year, monthIndex) {
    return dateConfigMap[String(year)]?.[MONTHS_EN_KEYS[monthIndex]] ?? 30;
}

function addBsMonth(year, monthIndex, delta) {
    let y = year;
    let m = monthIndex + delta;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    return { year: y, month: m };
}

export default function NepaliDateInput({
    value,
    onChange,
    min,
    max,
    disableFuture = false,
    disabled = false,
    required = false,
    placeholder = "Select date",
    className = "",
    id,
    compact = false,
}) {
    const [open, setOpen] = useState(false);
    const todayBs = NepaliDate.now();
    const selectedBs = adStringToBs(value);
    const minBs = adStringToBs(min);
    const maxBs = disableFuture ? todayBs : adStringToBs(max);

    const [viewYear, setViewYear] = useState((selectedBs ?? todayBs).getYear());
    const [viewMonth, setViewMonth] = useState((selectedBs ?? todayBs).getMonth());

    const wrapperRef = useRef(null);

    // Keep the visible month/year in sync if the value changes from outside (e.g. editing an existing record).
    useEffect(() => {
        const bs = adStringToBs(value);
        if (bs) {
            setViewYear(bs.getYear());
            setViewMonth(bs.getMonth());
        }
    }, [value]);

    useEffect(() => {
        if (!open) return;
        function handleClickOutside(e) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    const goMonth = (delta) => {
        const { year, month } = addBsMonth(viewYear, viewMonth, delta);
        setViewYear(year);
        setViewMonth(month);
    };
    const goYear = (delta) => setViewYear((y) => y + delta);

    const isDayDisabled = (year, monthIndex, day) => {
        const candidate = new NepaliDate(year, monthIndex, day);
        if (minBs && candidate.valueOf() < minBs.valueOf()) return true;
        if (maxBs && candidate.valueOf() > maxBs.valueOf()) return true;
        return false;
    };

    const handleSelectDay = (year, monthIndex, day) => {
        if (isDayDisabled(year, monthIndex, day)) return;
        const picked = new NepaliDate(year, monthIndex, day);
        onChange(bsToAdString(picked));
        setOpen(false);
    };

    // "Today" jumps the visible month to the current one, highlights and selects today's date, but leaves the popover open so the user can keep browsing.
    const handleToday = () => {
        setViewYear(todayBs.getYear());
        setViewMonth(todayBs.getMonth());
        if (!isDayDisabled(todayBs.getYear(), todayBs.getMonth(), todayBs.getDate())) {
            onChange(bsToAdString(todayBs));
        }
    };

    const handleClear = () => {
        onChange("");
        setOpen(false);
    };

    const displayLabel = selectedBs ? formatBsSlash(selectedBs) : "";
    const dayCount = daysInBsMonth(viewYear, viewMonth);
    const startWeekday = new NepaliDate(viewYear, viewMonth, 1).getDay();
    const { year: prevYear, month: prevMonth } = addBsMonth(viewYear, viewMonth, -1);
    const { year: nextYear, month: nextMonth } = addBsMonth(viewYear, viewMonth, 1);
    const prevMonthLength = daysInBsMonth(prevYear, prevMonth);
    const totalCells = 42;
    const trailingCount = totalCells - startWeekday - dayCount;

    // Small AD month/year caption shown above the BS month, e.g. "August/September 2026".
    const firstAd = new NepaliDate(viewYear, viewMonth, 1).toJsDate();
    const lastAd = new NepaliDate(viewYear, viewMonth, dayCount).toJsDate();
    const adCaption = (() => {
        const startLabel = firstAd.toLocaleString("en-US", { month: "long" });
        const endLabel = lastAd.toLocaleString("en-US", { month: "long" });
        if (firstAd.getFullYear() === lastAd.getFullYear()) {
            return startLabel === endLabel
                ? `${startLabel} ${firstAd.getFullYear()}`
                : `${startLabel}/${endLabel} ${firstAd.getFullYear()}`;
        }
        return `${startLabel} ${firstAd.getFullYear()}/${endLabel} ${lastAd.getFullYear()}`;
    })();

    // Builds one calendar cell: BS day (big) + AD day (small), for the current month or the dimmed overflow days from the adjacent months.
    const renderCell = (year, monthIndex, day, isOverflow) => {
        const adDay = new NepaliDate(year, monthIndex, day).toJsDate().getDate();
        const isSelected = !isOverflow && selectedBs
            && selectedBs.getYear() === year
            && selectedBs.getMonth() === monthIndex
            && selectedBs.getDate() === day;
        const isToday = !isOverflow
            && todayBs.getYear() === year
            && todayBs.getMonth() === monthIndex
            && todayBs.getDate() === day;
        const dayDisabled = isOverflow || isDayDisabled(year, monthIndex, day);

        return (
            <button
                key={`${year}-${monthIndex}-${day}-${isOverflow ? "o" : "c"}`}
                type="button"
                disabled={dayDisabled}
                onClick={() => !isOverflow && handleSelectDay(year, monthIndex, day)}
                className={`flex flex-col items-center justify-center leading-tight py-1.5 rounded-md transition
                    ${isSelected ? "bg-slate-800 text-white" : isOverflow ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"}
                    ${!isSelected && isToday ? "ring-1 ring-inset ring-slate-400" : ""}
                    ${dayDisabled && !isOverflow ? "opacity-30 cursor-not-allowed hover:bg-transparent" : ""}
                `}
            >
                <span className="text-sm">{toDevanagari(day)}</span>
                <span className={`text-[10px] ${isSelected ? "text-slate-200" : "text-gray-400"}`}>{adDay}</span>
            </button>
        );
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                type="button"
                id={id}
                disabled={disabled}
                onClick={() => !disabled && setOpen((o) => !o)}
                aria-required={required}
                className={
                    compact
                        ? `flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 text-sm bg-white text-left ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`
                        : `w-full flex items-center justify-between px-4 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900 outline-none focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100 transition text-left ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${className}`
                }
            >
                <span className={displayLabel ? "" : "text-gray-400"}>{displayLabel || placeholder}</span>
                <Calendar size={14} className="text-gray-400 shrink-0 ml-2" />
            </button>

            {open && (
                <div className="absolute z-20 mt-1 w-full min-w-[272px] bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <div className="text-center text-[11px] text-gray-400 mb-1">{adCaption}</div>

                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center">
                            <button type="button" onClick={() => goYear(-1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                                <ChevronsLeft size={14} />
                            </button>
                            <button type="button" onClick={() => goMonth(-1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                                <ChevronLeft size={14} />
                            </button>
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                            {MONTHS_NP[viewMonth]} {toDevanagari(viewYear)}
                        </span>
                        <div className="flex items-center">
                            <button type="button" onClick={() => goMonth(1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                                <ChevronRight size={14} />
                            </button>
                            <button type="button" onClick={() => goYear(1)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500">
                                <ChevronsRight size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 mb-1">
                        {WEEKDAYS_NP_SHORT.map((d, i) => (
                            <div key={`${d}-${i}`} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: startWeekday }, (_, i) =>
                            renderCell(prevYear, prevMonth, prevMonthLength - startWeekday + i + 1, true)
                        )}
                        {Array.from({ length: dayCount }, (_, i) => i + 1).map((day) =>
                            renderCell(viewYear, viewMonth, day, false)
                        )}
                        {Array.from({ length: trailingCount }, (_, i) =>
                            renderCell(nextYear, nextMonth, i + 1, true)
                        )}
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <button type="button" onClick={handleClear} className="text-xs text-gray-500 hover:text-gray-700">
                            Clear
                        </button>
                        <button type="button" onClick={handleToday} className="text-xs text-gray-900 font-medium hover:underline">
                            Today
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}