import type { z } from 'zod';

import { WRITE_FAILURE_CODES } from '#cli/config/system.ts';
import type { ErrorCode } from '#cli/types/system.ts';

export class GspotError extends Error {
    readonly code: ErrorCode;

    constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = 'GspotError';
        this.code = code;
    }
}

export class CheckStop extends Error {
    readonly status: 'skipped' | 'missing' | 'error';

    constructor(status: CheckStop['status'], note: string, options?: ErrorOptions) {
        super(note, options);
        this.name = 'CheckStop';
        this.status = status;
    }
}

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

export function tryParseFile<Value>(parse: () => Value): Value | undefined {
    try {
        return parse();
    } catch (error) {
        if (error instanceof GspotError && error.code === 'parse') return undefined;
        throw error;
    }
}

export function hasErrorCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

export function buildWriteError(path: string, error: unknown): unknown {
    if (WRITE_FAILURE_CODES.some((code) => hasErrorCode(error, code)))
        return new GspotError(
            'filesystem',
            `Cannot write ${path}. Check its permissions and whether the filesystem is read-only, then run the command again.`,
            { cause: error },
        );
    return error;
}
