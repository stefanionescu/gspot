import { parse, type ParseError } from 'jsonc-parser';

/**
 * Parses configuration JSON with comments and trailing commas, rejecting partial results.
 * @param text the configuration text
 * @returns the parsed configuration
 * @throws when the text does not parse
 */
export function parseJsonc(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true });
    if (errors.length > 0) throw new Error(`Invalid JSON configuration at offset ${String(errors[0]?.offset)}.`);
    return value;
}

/**
 * The value of JSON with comments and trailing commas, for a reader that reports a broken file its own way.
 * @param text the text
 * @returns the value, or undefined when the text does not parse
 */
export function jsoncValue(text: string): unknown {
    const errors: ParseError[] = [];
    const value: unknown = parse(text, errors, { allowTrailingComma: true });
    return errors.length === 0 ? value : undefined;
}
