import { parse, type ParseError, printParseErrorCode } from 'jsonc-parser';

/**
 * Parses configuration JSON with comments and trailing commas, rejecting partial results.
 * @param text the configuration text
 * @returns the parsed configuration
 * @throws when the text does not parse
 */
export function parseJsonc(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true });
    const problem = errors[0];
    if (problem !== undefined)
        throw new Error(
            `Invalid JSON configuration at offset ${String(problem.offset)}: ${printParseErrorCode(problem.error)}.`,
        );
    return value;
}
