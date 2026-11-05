import type { z } from 'zod';
import type { ErrorCode } from '#cli/types/system.ts';
import { WRITE_FAILURE_CODES } from '#cli/config/system.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    /**
    Keep a failure category and one message.

    @param code the failure category.
    @param message the failure in plain English.
    @param options the underlying cause, when one exists.
    */
    constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'GspotError';
        this.code = code;
    }
}

export class CheckStop extends Error {
    readonly status: 'skipped' | 'missing' | 'error';

    /**
    Stop one check with the status and the note that its result prints.

    @param status how the check ends.
    @param note why it ends.
    @param options the underlying cause, when one exists.
    */
    constructor(status: CheckStop['status'], note: string, options?: ErrorOptions) {
        super(note, options);
        this.name = 'CheckStop';
        this.status = status;
    }
}

/**
Format a Zod issue and its union branches as field paths and messages.

@param issue one Zod failure.
@returns the message lines, with the full path of each nested field.
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
Validate fields from a user file, and name the file and failing fields.

@param path the file whose fields need validation.
@param value the parsed file contents.
@param schema the fields and constraints to check.
*/
export function parseFileFields<Value>(path: string, value: unknown, schema: z.ZodType<Value>): Value {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new GspotError(
            'parse',
            `${path}: ${parsed.error.issues.flatMap((issue) => formatZodIssue(issue)).join('; ')}. Fix the field.`,
            { cause: parsed.error },
        );
    return parsed.data;
}

/**
Read a file of the user that gspot can go on without.

@param parse the read, which names the file when it cannot parse it.
@returns the value, or undefined when the file does not parse.
*/
export function tryParseFile<Value>(parse: () => Value): Value | undefined {
    try {
        return parse();
    } catch (error) {
        if (error instanceof GspotError && error.code === 'parse') return undefined;
        throw error;
    }
}

/**
Check whether an operation failed with an operating-system error code.

@param error the caught value.
@param code the operating-system error code to match.
*/
export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

/**
Describe a denied file mutation with the path and retain its original cause.

@param path the affected path.
@param error the operating-system failure.
@returns the contextual permission failure, or the original error.
*/
export function buildWriteError(path: string, error: unknown): unknown {
    if (WRITE_FAILURE_CODES.some((code) => hasErrorCode(error, code)))
        return new GspotError(
            'filesystem',
            `Cannot write ${path}. Check its permissions and whether the filesystem is read-only, then run the command again.`,
            { cause: error },
        );
    return error;
}
