/**
 *   Admin       Full access: create/edit/delete all, manage users, view all reports
 *   Accountant  Create/edit transactions, view reports, cannot delete or manage users
 *   User        Create invoice / view customer statement only, no other transactions
 *
 */

export const ROLES = {
    ADMIN: "admin",
    ACCOUNTANT: "accountant",
    USER: "user",
};

const PERMISSIONS = {
    [ROLES.ADMIN]: {
        canCreateTransactions: true, // invoices, bills, receipts, payments, journal, banking
        canEditTransactions: true,
        canApprove: true,           // maker-checker: admin-only
        canVoid: true,              // admin-only
        canDelete: true,            // contacts, items, accounts, account groups
        canManageUsers: true,
        canViewReports: true,
        canViewAuditLogs: true,
        canCreateInvoiceOnly: true, // subset of canCreateTransactions, admin has full access anyway
    },
    [ROLES.ACCOUNTANT]: {
        canCreateTransactions: true,
        canEditTransactions: true,
        canApprove: false,          // maker-checker: accountant cannot approve their own drafts
        canVoid: false,
        canDelete: false,
        canManageUsers: false,
        canViewReports: true,
        canViewAuditLogs: false,
        canCreateInvoiceOnly: true,
    },
    [ROLES.USER]: {
        canCreateTransactions: false, // no bills/receipts/payments/journal/banking
        canEditTransactions: false,
        canApprove: false,
        canVoid: false,
        canDelete: false,
        canManageUsers: false,
        canViewReports: true,          // view-only, incl. customer statement / ledger reports
        canViewAuditLogs: false,
        canCreateInvoiceOnly: true,    // the one write action PRD grants this role
    },
};

const DEFAULT_PERMS = {
    canCreateTransactions: false,
    canEditTransactions: false,
    canApprove: false,
    canVoid: false,
    canDelete: false,
    canManageUsers: false,
    canViewReports: false,
    canViewAuditLogs: false,
    canCreateInvoiceOnly: false,
};

export function can(role, capability) {
    const perms = PERMISSIONS[role] ?? DEFAULT_PERMS;
    return !!perms[capability];
}

export function getPermissions(role) {
    return PERMISSIONS[role] ?? DEFAULT_PERMS;
}

export const ROUTE_ROLES = {
    "/dashboard": [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.USER],
    "/contacts": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/items": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/transactions": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/sales/invoices": [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.USER],
    "/sales/receipts": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/purchases/bills": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/purchases/payments": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/banking/deposits": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/banking/withdrawals": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/banking/paytds": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/journal": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/chartofaccounts": [ROLES.ADMIN, ROLES.ACCOUNTANT],
    "/users": [ROLES.ADMIN],
    "/activitylogs": [ROLES.ADMIN],
    "/reports": [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.USER],
    "/settings": [ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.USER],
};

/** Reports use a dynamic /reports/:reportKey path, handled separately from the static map. */
export function isRouteAllowed(role, pathname) {
    if (pathname.startsWith("/reports/")) {
        return ROUTE_ROLES["/reports"].includes(role);
    }
    const allowed = ROUTE_ROLES[pathname];
    // Unmapped routes default to admin/accountant only (fail closed, not open).
    return allowed ? allowed.includes(role) : [ROLES.ADMIN, ROLES.ACCOUNTANT].includes(role);
}

/** First route a role should land on after login, for redirects. */
export function homeRouteFor(role) {
    return role === ROLES.USER ? "/sales/invoices" : "/dashboard";
}