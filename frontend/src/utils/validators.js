// Contacts
export const NAME_REGEX = /^[A-Za-z\s.,'&-]+$/;
export const PAN_REGEX = /^\d{9}$/;
export const NEPAL_PHONE_REGEX = /^9[78]\d{8}$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(value, { required = true, label = "Name" } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? `${label} is required.` : "";
    if (!NAME_REGEX.test(v)) {
        return `${label} can only contain letters, spaces, and . , ' & -`;
    }
    return "";
}

export function validatePan(value, { required = false } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? "PAN is required." : "";
    if (!PAN_REGEX.test(v)) {
        return "PAN must be exactly 9 digits, numbers only.";
    }
    return "";
}

export function validateNepaliPhone(value, { required = false } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? "Phone number is required." : "";
    if (!NEPAL_PHONE_REGEX.test(v)) {
        return "Phone number must be 10 digits and start with 97 or 98.";
    }
    return "";
}

export function validateEmail(value, { required = false } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? "Email is required." : "";
    if (!EMAIL_REGEX.test(v)) {
        return "Enter a valid email address.";
    }
    return "";
}

export function filterNameInput(value) {
    return (value ?? "").replace(/[^A-Za-z\s.,'&-]/g, "");
}

// Strips non-digits and caps length. Used for PAN (9) and Phone (10).
export function filterDigitsOnly(value, maxLen) {
    const digits = (value ?? "").replace(/\D/g, "");
    return maxLen ? digits.slice(0, maxLen) : digits;
}

export function runValidators(form, validatorMap) {
    const errors = {};
    for (const [field, validator] of Object.entries(validatorMap)) {
        const message = validator(form[field]);
        if (message) errors[field] = message;
    }
    return errors;
}

// Items
export const ITEM_NAME_REGEX = /^[A-Za-z0-9\s.,'&()/-]+$/;
export const UNIT_REGEX = /^[A-Za-z\s./-]+$/;
export const HSN_SAC_REGEX = /^\d{2,20}$/;

export function validateItemName(value, { required = true, label = "Item name" } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? `${label} is required.` : "";
    if (v.length > 150) return `${label} must be 150 characters or fewer.`;
    if (!ITEM_NAME_REGEX.test(v)) {
        return `${label} can only contain letters, numbers, spaces, and . , ' & ( ) / -`;
    }
    return "";
}

export function validateUnit(value, { required = true } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? "Unit is required." : "";
    if (v.length > 30) return "Unit must be 30 characters or fewer.";
    if (!UNIT_REGEX.test(v)) return "Unit can only contain letters, spaces, and . / -";
    return "";
}

export function validateHsnSac(value, { required = true } = {}) {
    const v = (value ?? "").trim();
    if (!v) return required ? "HSN/SAC code is required." : "";
    if (!HSN_SAC_REGEX.test(v)) return "HSN/SAC code must be 2 to 20 digits, numbers only.";
    return "";
}

export function validatePrice(value, { required = false, label = "Price" } = {}) {
    if (value === '' || value === null || value === undefined) {
        return required ? `${label} is required.` : "";
    }
    const num = Number(value);
    if (Number.isNaN(num)) return `${label} must be a valid number.`;
    if (num < 0) return `${label} cannot be negative.`;
    return "";
}

export function filterItemNameInput(value) {
    return (value ?? "").replace(/[^A-Za-z0-9\s.,'&()/-]/g, "");
}

export function filterUnitInput(value) {
    return (value ?? "").replace(/[^A-Za-z\s./-]/g, "");
}

// Allows digits and a single decimal point; used for price fields.
export function filterDecimalInput(value) {
    let v = (value ?? "").replace(/[^0-9.]/g, "");
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
        v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "");
    }
    return v;
}

// Users
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

export function validatePassword(value, { required = true } = {}) {
    const v = value ?? "";
    if (!v) return required ? "Password is required." : "";
    if (!PASSWORD_REGEX.test(v)) {
        return "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.";
    }
    return "";
}