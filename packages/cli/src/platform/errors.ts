// The one error gspot raises on purpose: a code says what went wrong, the problems say it in plain English.
import type { ErrorCode } from '#cli/types/platform/platform.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    readonly problems: string[];

    /**
     * Joins the problems into the message and keeps them as a list.
     * @param code what kind of failure this is
     * @param problems the problems in plain English, one or several
     * @param options the underlying cause, when one exists
     */
    constructor(code: ErrorCode, problems: string | string[], options?: ErrorOptions) {
        const list = typeof problems === 'string' ? [problems] : problems;
        super(list.join('\n'), options);
        this.name = 'GspotError';
        this.code = code;
        this.problems = list;
    }
}
