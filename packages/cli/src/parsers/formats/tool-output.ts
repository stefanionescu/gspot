import { z } from 'zod';
import { CheckStop } from '#cli/system/errors.ts';

export function parseToolOutput(tool: string, text: string): unknown;

export function parseToolOutput<Value>(tool: string, text: string, schema: z.ZodType<Value>): Value;

/**
Parse and validate the output of a tool, and keep its untrusted contents out of errors.
*/
export function parseToolOutput(tool: string, text: string, schema?: z.ZodType): unknown {
    try {
        const parsed: unknown = JSON.parse(text);
        return schema === undefined ? parsed : schema.parse(parsed);
    } catch (error) {
        if (!(error instanceof SyntaxError) && !(error instanceof z.ZodError)) throw error;
        throw new CheckStop('error', `${tool} printed output that gspot cannot read.`, { cause: error });
    }
}
