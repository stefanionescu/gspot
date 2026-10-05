// An error with a failure code so callers can branch.
// Other errors use the `gspot stopped` prefix in text output.
import type { ErrorCode } from '#cli/types/platform/runtime.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    readonly problems: string[];

    /**
     * Joins the problems into the message and keeps them as a list.
     * @param code what kind of failure this is.
     * @param problems one or several problems in plain English.
     * @param options the underlying cause, when one exists.
     */
    constructor(code: ErrorCode, problems: string | string[], options?: ErrorOptions) {
        const list = typeof problems === 'string' ? [problems] : problems;
        super(list.join('\n'), options);
        this.name = 'GspotError';
        this.code = code;
        this.problems = list;
    }
}
