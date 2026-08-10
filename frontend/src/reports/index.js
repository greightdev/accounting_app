import { ACCOUNTING_REPORTS } from "./accountingReports";
import { SALES_REPORTS } from "./salesReports";
import { PURCHASE_REPORTS } from "./purchaseReports";
import { RECEIVABLES_REPORTS } from "./receivablesReports";
import { PAYABLES_REPORTS } from "./payablesReports";
import { TDS_REPORTS } from "./tdsReports";
import { NEPALI_TAX_REPORTS } from "./nepaliTaxReports";

export const REPORT_REGISTRY = {
    ...ACCOUNTING_REPORTS,
    ...SALES_REPORTS,
    ...PURCHASE_REPORTS,
    ...RECEIVABLES_REPORTS,
    ...PAYABLES_REPORTS,
    ...TDS_REPORTS,
    ...NEPALI_TAX_REPORTS,
};