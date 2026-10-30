import { read } from '#cli/system/files/reads.ts';
import { WHITESPACE_RUN } from '#cli/config/text.ts';
import type { Session } from '#cli/types/session.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { type CheckFinding } from '#cli/types/runs/check.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import type { HeaderBlock, ParsedHeadersFile } from '#cli/types/checks/platform.ts';
import { SYNTAX_RULE } from '#cli/config/checks/cross-configuration/cross-configuration.ts';

import {
    HEADERS_FILE,
    DETACH_PREFIX,
    PATH_PREFIXES,
    INDENTED_LINE,
    REDIRECTS_FILE,
    REDIRECT_FIELDS,
    FRAME_ANCESTORS,
    HTTP_HEADER_LINE,
    REQUIRED_HEADERS,
    BLOCK_PATH_MESSAGE,
    MISSING_HEADER_RULE,
    REDIRECT_STATUS_CODES,
    REDIRECT_FIELDS_MESSAGE,
    REDIRECT_SOURCE_MESSAGE,
    MALFORMED_HEADER_MESSAGE,
    HEADER_WITHOUT_PATH_MESSAGE,
    REDIRECT_DESTINATION_MESSAGE,
} from '#cli/config/checks/platform.ts';

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
            if (!PATH_PREFIXES.some((prefix) => line.text.startsWith(prefix)))
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

function validateRedirects(text: string): NumberedLine[] {
    return splitContentLines(text).flatMap((line) => {
        const segments = line.text.trim().split(WHITESPACE_RUN);
        const [source, destination, status] = segments as [string, string, string | undefined];
        if (segments.length < REDIRECT_FIELDS.minimum || segments.length > REDIRECT_FIELDS.maximum)
            return [
                {
                    number: line.number,
                    text: REDIRECT_FIELDS_MESSAGE,
                },
            ];
        if (!source.startsWith('/')) return [{ number: line.number, text: REDIRECT_SOURCE_MESSAGE }];
        if (!PATH_PREFIXES.some((prefix) => destination.startsWith(prefix)))
            return [{ number: line.number, text: REDIRECT_DESTINATION_MESSAGE }];
        if (status === undefined) return [];
        const isRedirectStatus = REDIRECT_STATUS_CODES.has(status);
        return isRedirectStatus
            ? []
            : [{ number: line.number, text: `Use a supported Cloudflare redirect status instead of ${status}.` }];
    });
}

/**
Reports syntax errors in each _redirects file.

@param session the repository and its tools.
@param planned the scope files to read.
*/
export function checkRedirects(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [REDIRECTS_FILE]).flatMap((path) =>
        validateRedirects(read(session.cache, path)).map((invalidLine) => ({
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
export function checkHeaders(session: Session, planned: PlannedCheck): CheckFinding[] {
    return listSourcePaths(planned.files, [HEADERS_FILE]).flatMap((path) => {
        const { blocks, errors } = parseHeadersFile(read(session.cache, path));
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
