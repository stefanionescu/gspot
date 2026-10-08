// An error with a failure code so callers can branch.
// Other errors use the `gspot stopped` prefix in text output.
import type { ErrorCode } from '#cli/types/platform/runtime.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    readonly errors: string[];

    /**
     * Joins the errors into the message and keeps them as a list.
     * @param code what kind of failure this is.
     * @param errors one or several errors in plain English.
     * @param options the underlying cause, when one exists.
     */
    constructor(code: ErrorCode, errors: string | string[], options?: ErrorOptions) {
        const list = typeof errors === 'string' ? [errors] : errors;
        super(list.join('\n'), options);
        this.name = 'GspotError';
        this.code = code;
        this.errors = list;
    }
}
