// Defines coded errors for command failures.
import type { z } from 'zod';
import type { ErrorCode } from '#cli/types/errors.ts';

/** Carries a failure code for callers to branch on. gspot reports anything else thrown as an internal failure. */
export class GspotError extends Error {
    readonly code: ErrorCode;

    /**
     * Keep a failure category and one message.
     *
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
 *
 * @param issue one Zod failure.
 * @returns the message lines, with the full path of each nested field.
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

/**
 * Check whether a file operation failed because the path does not exist.
 *
 * @param error the caught value.
 * @returns whether the error says the file does not exist.
 */
export function isMissingFileError(error: unknown): boolean {
    return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
