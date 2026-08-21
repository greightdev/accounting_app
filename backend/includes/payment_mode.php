<?php

function validPaymentModes(): array
{
    return ['CASH', 'CHEQUE', 'BANK_TRANSFER', 'CONNECT_IPS', 'ESEWA'];
}

// Modes where a cheque number / transaction ID is meaningful and required.
function paymentModeRequiresRef(string $mode): bool
{
    return in_array($mode, ['CHEQUE', 'BANK_TRANSFER', 'CONNECT_IPS', 'ESEWA'], true);
}

function validatePaymentModeAndRef(string $paymentMode, string $paymentRef, string $bankAccountType): array
{
    $errors = [];

    if (!in_array($paymentMode, validPaymentModes(), true)) {
        $errors[] = "Payment mode is invalid.";
        return $errors;
    }

    if ($bankAccountType === 'CASH' && $paymentMode !== 'CASH') {
        $errors[] = "A cash account can only be paired with the Cash payment mode.";
    }
    if ($bankAccountType === 'BANK' && $paymentMode === 'CASH') {
        $errors[] = "A bank account cannot be paired with the Cash payment mode.";
    }

    if (paymentModeRequiresRef($paymentMode) && $paymentRef === '') {
        $errors[] = "Enter the cheque number / transaction ID for this payment mode.";
    }
    if (strlen($paymentRef) > 100) {
        $errors[] = "Cheque number / transaction ID must be 100 characters or fewer.";
    }

    return $errors;
}
