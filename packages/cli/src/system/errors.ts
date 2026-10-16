// Defines coded errors for command failures.
import type { z } from 'zod';
import type { ErrorCode } from '#cli/types/errors.ts';

/** An error with a failure code, so callers can branch. gspot reports any other error as an internal error. */
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

/**
 * Format a Zod issue and its union branches as field paths and messages.
 * @param issue the validation issue.
 * @returns the diagnostic lines with each nested field's full path.
 */
export function formatZodIssue(issue: z.core.$ZodIssue): string[] {
    const path = issue.path.map(String).join('.');
    const line = path === '' ? issue.message : `${path}: ${issue.message}`;
    return issue.code === 'invalid_union'
        ? [
              line,
              ...issue.errors.flatMap((branch) =>
                  branch.flatMap((nested) => formatZodIssue({ ...nested, path: [...issue.path, ...nested.path] })),
              ),
          ]
        : [line];
}
