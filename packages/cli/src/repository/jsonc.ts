import { parse, type ParseError } from 'jsonc-parser';

/**
 * Parses configuration JSON with comments and trailing commas, rejecting partial results.
 * @param text the configuration text
 * @returns the parsed configuration
 */
export function parseJsonc(text: string): unknown {
    const errors: ParseError[] = [];
    const parsed: unknown = parse(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`Invalid JSON configuration at offset ${String(errors[0]?.offset)}.`);
    return parsed;
}
