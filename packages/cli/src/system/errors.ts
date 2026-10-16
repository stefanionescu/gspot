// Defines coded errors for command failures.
import type { ErrorCode } from '#cli/types/errors.ts';

// An error with a failure code so callers can branch.
// Other errors use the `gspot stopped` prefix in text output.

export class GspotError extends Error {
    readonly code: ErrorCode;

    /**
     * Keep a failure category and one message.
     * @param code the failure category.
     * @param message the failure in plain English.
     * @param options the underlying cause, when one exists.
     */
    constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'GspotError';
        this.code = code;
    }
}
