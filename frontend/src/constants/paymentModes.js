// Shared across Receipts, Payments, Bank Deposits/Withdrawals, and TDS Payments

export const PAYMENT_MODES = [
    { value: "CASH", label: "Cash" },
    { value: "CHEQUE", label: "Cheque" },
    { value: "BANK_TRANSFER", label: "Bank Transfer" },
    { value: "CONNECT_IPS", label: "ConnectIPS" },
    { value: "ESEWA", label: "eSewa" },
];

// Modes where a cheque number / transaction ID is meaningful and required.
export const PAYMENT_MODES_REQUIRING_REF = ["CHEQUE", "BANK_TRANSFER", "CONNECT_IPS", "ESEWA", "KHALTI"];

export function paymentModeRequiresRef(mode) {
    return PAYMENT_MODES_REQUIRING_REF.includes(mode);
}

export function paymentRefLabel(mode) {
    return mode === "CHEQUE" ? "Cheque Number" : "Transaction ID";
}

export function paymentModeLabel(mode) {
    return PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode;
}

// Non-cash options — used on forms whose bank account leg is always a BANK-type
// account (Deposits/Withdrawals), where the Cash mode wouldn't make sense.
export const NON_CASH_PAYMENT_MODES = PAYMENT_MODES.filter((m) => m.value !== "CASH");
