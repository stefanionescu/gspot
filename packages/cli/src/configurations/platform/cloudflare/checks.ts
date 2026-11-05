import {
    BLOCK_PATH_MESSAGE,
    DETACH_PREFIX,
    FRAME_ANCESTORS,
    HEADER_WITHOUT_PATH_MESSAGE,
    HEADERS_FILE,
    HTTP_HEADER_LINE,
    INDENTED_LINE,
    MALFORMED_HEADER_MESSAGE,
    MISSING_HEADER_RULE,
    PATH_PREFIXES,
    REDIRECT_DESTINATION_MESSAGE,
    REDIRECT_FIELDS,
    REDIRECT_FIELDS_MESSAGE,
    REDIRECT_SOURCE_MESSAGE,
    REDIRECT_STATUS_CODES,
    REDIRECTS_FILE,
    REQUIRED_HEADERS,
    SYNTAX_RULE,
} from '#cli/config/configurations/infrastructure.ts';
import { WHITESPACE_RUN } from '#cli/config/parsers.ts';
import { HEADER_EXPLANATIONS } from '#cli/configurations/platform/cloudflare/explanations.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { HeaderBlock, ParsedHeadersFile } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { NumberedLine } from '#cli/types/parsers.ts';
import type { Session } from '#cli/types/tools.ts';

function splitContentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

function addHeader(block: HeaderBlock | undefined, line: NumberedLine): NumberedLine[] {
    if (block === undefined) return [{ number: line.number, text: HEADER_WITHOUT_PATH_MESSAGE }];
    const header = line.text.trim();
    if (header.startsWith(DETACH_PREFIX)) return [];
    if (!HTTP_HEADER_LINE.test(header)) return [{ number: line.number, text: MALFORMED_HEADER_MESSAGE }];
    const colon = header.indexOf(':');
    block.headers.push({ name: header.slice(0, colon).toLowerCase(), value: header.slice(colon + 1).trim() });
    return [];
}

function parseHeadersFile(text: string): ParsedHeadersFile {
    const blocks: HeaderBlock[] = [];
    const errors: NumberedLine[] = [];
    for (const line of splitContentLines(text)) {
        if (!INDENTED_LINE.test(line.text)) {
            blocks.push({ path: line.text.trim(), headers: [] });
            if (PATH_PREFIXES.every((prefix) => !line.text.startsWith(prefix)))
                errors.push({
                    number: line.number,
                    text: BLOCK_PATH_MESSAGE,
                });
            continue;
        }
        errors.push(...addHeader(blocks.at(-1), line));
    }
    return { blocks, errors };
}

function listMissingHeaders(blocks: HeaderBlock[]): string[] {
    const held = new Map(
        blocks
            .filter((block) => block.path === '/*')
            .flatMap((block) => block.headers.map(({ name, value }) => [name, value])),
    );
    const hasFrameRule = FRAME_ANCESTORS.test(held.get('content-security-policy') ?? '');
    return Object.entries(REQUIRED_HEADERS)
        .filter(
            ([name, pattern]) => !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
        )
        .map(([name]) => name);
}

function validateRedirectLine(text: string): string | undefined {
    const segments = text.trim().split(WHITESPACE_RUN);
    const [source, destination, status] = segments as [string, string, string | undefined];
    if (segments.length < REDIRECT_FIELDS.minimum || segments.length > REDIRECT_FIELDS.maximum)
        return REDIRECT_FIELDS_MESSAGE;
    if (!source.startsWith('/')) return REDIRECT_SOURCE_MESSAGE;
    if (PATH_PREFIXES.every((prefix) => !destination.startsWith(prefix))) return REDIRECT_DESTINATION_MESSAGE;
    return status === undefined || REDIRECT_STATUS_CODES.has(status)
        ? undefined
        : `Use a supported Cloudflare redirect status instead of ${status}.`;
}

function validateRedirects(text: string): NumberedLine[] {
    return splitContentLines(text).flatMap((line) => {
        const message = validateRedirectLine(line.text);
        return message === undefined ? [] : [{ number: line.number, text: message }];
    });
}

/**
Reports syntax errors in each _redirects file.

@param session the repository and its tools.
@param planned the scope files to read.
*/
function checkRedirects(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [REDIRECTS_FILE]).flatMap((path) =>
        validateRedirects(readText(session.cache, path)).map((invalidLine) => ({
            file: path,
            line: invalidLine.number,
            rule: SYNTAX_RULE,
            message: invalidLine.text,
        })),
    );
}

/**
Reports syntax errors in each _headers file, and each security header that the block for every path does not set.

@param session the repository and its tools.
@param planned the scope files to read.
*/
function checkHeaders(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [HEADERS_FILE]).flatMap((path) => {
        const { blocks, errors } = parseHeadersFile(readText(session.cache, path));
        return [
            ...errors.map((error) => ({
                file: path,
                line: error.number,
                rule: SYNTAX_RULE,
                message: error.text,
            })),
            ...listMissingHeaders(blocks).map((name) => ({
                file: path,
                line: 1,
                rule: MISSING_HEADER_RULE,
                message: `The block for /* sets no valid ${name} header.`,
            })),
        ];
    });
}

export const CLOUDFLARE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'cloudflare/headers': { check: checkHeaders, explanations: HEADER_EXPLANATIONS },
    'cloudflare/redirects': { check: checkRedirects },
};
