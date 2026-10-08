import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/jsonc.ts';
import { isRecord } from '#cli/platform/objects.ts';
import type { NumberedLine } from '#cli/types/parsers/source.ts';
import type { WranglerParse } from '#cli/types/parsers/cloudflare.ts';
import { STATUS_CODES, REDIRECT_PARTS, HTTP_HEADER_LINE } from '#cli/config/parsers/cloudflare.ts';

function contentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

/**
 * Parse a Wrangler document without repository I/O.
 * @param text the authored document contents
 * @param path the document path for selecting TOML or JSON with comments
 * @returns the parsed object or its syntax diagnostic
 */
export function parseWrangler(text: string, path: string): WranglerParse {
    try {
        if (path.endsWith('.toml')) return { table: parseToml(text), problem: undefined };
        const parsed = parseJsonc(text);
        return isRecord(parsed)
            ? { table: parsed, problem: undefined }
            : { table: undefined, problem: 'The file does not parse as JSON with comments.' };
    } catch (error) {
        return { table: undefined, problem: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

/**
 * The findings of one headers file: a header line under no path, and an indented line that is no header.
 * @param text the authored asset contents
 * @returns the findings, each with its line
 */
export function headerFindings(text: string): NumberedLine[] {
    const entries = contentLines(text);
    let hasPath = false;
    return entries.flatMap((line) => {
        if (/^\s/u.test(line.text)) {
            if (!hasPath) return [{ number: line.number, text: 'Add a path line before this header.' }];
            const header = line.text.trim();
            const isHeader = HTTP_HEADER_LINE.test(header) || header.startsWith('! ');
            return isHeader ? [] : [{ number: line.number, text: 'Write this header as Name: value.' }];
        }
        hasPath = true;
        const isPath = line.text.startsWith('/') || line.text.startsWith('https://');
        return isPath
            ? []
            : [
                  {
                      number: line.number,
                      text: 'Start this block with a path beginning with / or an https:// address.',
                  },
              ];
    });
}

/**
 * The findings of one redirects file: each rule is a source, a destination, and an optional status Cloudflare knows.
 * @param text the authored asset contents
 * @returns the findings, each with its line
 */
export function redirectFindings(text: string): NumberedLine[] {
    const entries = contentLines(text);
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.least || parts.length > REDIRECT_PARTS.most)
            return [{ number: line.number, text: 'A redirect is a source, a destination, and an optional status.' }];
        if (!source.startsWith('/') && !source.startsWith('https://'))
            return [{ number: line.number, text: 'Start the redirect source with / or https://.' }];
        if (status === undefined) return [];
        const isKnown = STATUS_CODES.has(status);
        return isKnown
            ? []
            : [{ number: line.number, text: `Use a supported Cloudflare redirect status instead of ${status}.` }];
    });
}
