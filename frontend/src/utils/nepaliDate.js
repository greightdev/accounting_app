import NepaliDate from "nepali-date-converter";

const pad2 = (n) => String(n).padStart(2, "0");

export function formatBsDate(adDateInput) {
    if (!adDateInput) return "";
    const raw = String(adDateInput);
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw);
    if (Number.isNaN(d.getTime())) return "";
    const bs = new NepaliDate(d);
    return `${bs.getYear()}/${pad2(bs.getMonth() + 1)}/${pad2(bs.getDate())}`;
}