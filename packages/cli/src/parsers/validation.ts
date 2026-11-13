import type { z } from 'zod';

import { GspotError } from '#cli/system/errors.ts';

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
