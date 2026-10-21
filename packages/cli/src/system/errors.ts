// Defines coded errors for command failures.
import type { z } from 'zod';
import type { ErrorCode } from '#cli/types/system/errors.ts';

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
 * Validate fields from a user file, and name the file and failing fields.
 *
 * @param path the file whose fields need validation.
 * @param value the parsed file contents.
 * @param schema the fields and constraints to check.
 * @returns the validated fields.
 */
export function parseFileFields<Value>(path: string, value: unknown, schema: z.ZodType<Value>): Value {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new GspotError(
            'filesystem',
            `${path}: ${parsed.error.issues.flatMap((issue) => formatZodIssue(issue)).join('; ')}. Fix the field.`,
            { cause: parsed.error },
        );
    return parsed.data;
}

/**
 * Check whether an operation failed with an operating-system error code.
 *
 * @param error the caught value.
 * @param code the operating-system error code to match.
 * @returns whether the error carries that code.
 */
export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}
