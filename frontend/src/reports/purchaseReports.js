import { formatBsDate } from "../utils/nepaliDate";

export const PURCHASE_REPORTS = {
    "purchase-register": {
        title: "Purchase Register",
        endpoint: "/reports/purchase_reports/purchase_register.php",
        extraFilters: [
            {
                key: "contact_id",
                label: "Vendor",
                optionsEndpoint: "/contacts/list.php?type=Vendor",
                required: false,
            },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Ref #", render: (r) => r.display_ref_number || r.ref_number },
            { key: "contact_pan", header: "PAN", render: (r) => r.contact_pan ?? "-" },
            { key: "sub_total", header: "Taxable", align: "right", render: (r) => Number(r.sub_total || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "vat_amount", header: "VAT", align: "right", render: (r) => Number(r.vat_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_amount", header: "Total", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { sub_total: "total_taxable", vat_amount: "total_vat", total_amount: "total_amount" },
        footerLabelColumn: "contact_name",
    },
    "purchase-by-vendor": {
        title: "Purchase By Vendor",
        endpoint: "/reports/purchase_reports/purchase_by_vendor.php",
        columns: [
            { key: "contact_name", header: "Vendor" },
            { key: "contact_pan", header: "PAN", render: (r) => r.contact_pan ?? "-" },
            { key: "transaction_count", header: "Bills", align: "right" },
            { key: "total_taxable", header: "Taxable", align: "right", render: (r) => Number(r.total_taxable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_vat", header: "VAT", align: "right", render: (r) => Number(r.total_vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_amount", header: "Total", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { total_taxable: "total_taxable", total_vat: "total_vat", total_amount: "total_amount" },
        footerLabelColumn: "contact_name",
    },
    "purchase-by-item": {
        title: "Purchase By Item",
        endpoint: "/reports/purchase_reports/purchase_by_item.php",
        columns: [
            { key: "item_name", header: "Item" },
            { key: "unit", header: "Unit", render: (r) => r.unit ?? "-" },
            { key: "hsn_sac_code", header: "HSN/SAC", render: (r) => r.hsn_sac_code ?? "-" },
            { key: "total_quantity", header: "Qty", align: "right" },
            { key: "total_taxable", header: "Taxable", align: "right", render: (r) => Number(r.total_taxable || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_vat", header: "VAT", align: "right", render: (r) => Number(r.total_vat || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "total_amount", header: "Total", align: "right", render: (r) => Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { total_taxable: "total_taxable", total_vat: "total_vat", total_amount: "total_amount" },
        footerLabelColumn: "item_name",
    },
    "master-purchase": {
        title: "Master Purchase Report",
        endpoint: "/reports/purchase_reports/master_purchase.php",
        extraFilters: [
            { key: "contact_id", label: "Vendor", optionsEndpoint: "/contacts/list.php?type=Vendor", required: false },
        ],
        columns: [
            { key: "date", header: "Date", render: (r) => formatBsDate(r.date) },
            { key: "ref_number", header: "Bill #", render: (r) => r.display_ref_number || r.ref_number },
            { key: "item_name", header: "Name" },
            { key: "rate", header: "Rate", align: "right", render: (r) => Number(r.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "quantity", header: "Quantity", align: "right" },
            { key: "purchase_amount", header: "Purchase Amount", align: "right", render: (r) => Number(r.purchase_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "taxable_amount", header: "Taxable", align: "right", render: (r) => Number(r.taxable_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "tax", header: "Tax", align: "right", render: (r) => Number(r.tax || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
            { key: "bill_amount", header: "Bill Amount", align: "right", render: (r) => Number(r.bill_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 }) },
        ],
        footerMeta: { purchase_amount: "total_purchase", taxable_amount: "total_taxable", tax: "total_tax", bill_amount: "total_bill" },
        footerLabelColumn: "item_name",
    },
};