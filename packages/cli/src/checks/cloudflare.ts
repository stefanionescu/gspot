import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/covered-files.ts';
import type { HeaderBlock, ParsedHeadersFile } from '#cli/types/checks/cloudflare.ts';

import {
    HEADERS_FILE,
    DETACH_PREFIX,
    PATH_PREFIXES,
    REDIRECT_PARTS,
    REDIRECTS_FILE,
    FRAME_ANCESTORS,
    HTTP_HEADER_LINE,
    REQUIRED_HEADERS,
    REDIRECT_STATUS_CODES,
} from '#cli/config/checks/cloudflare.ts';

function splitContentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

/**
 * Parses a _headers file into path blocks and syntax errors, with line numbers.
 *
 * @param text the _headers file.
 * @returns the blocks and syntax errors.
 */
function parseHeadersFile(text: string): ParsedHeadersFile {
    const blocks: HeaderBlock[] = [];
    const errors = splitContentLines(text).flatMap((line): NumberedLine[] => {
        if (!/^\s/u.test(line.text)) {
            blocks.push({ path: line.text.trim(), headers: [] });
            return PATH_PREFIXES.some((prefix) => line.text.startsWith(prefix))
                ? []
                : [
                      {
                          number: line.number,
                          text: 'Start this block with a path beginning with / or an https:// address.',
                      },
                  ];
        }
        const block = blocks.at(-1);
        if (block === undefined) return [{ number: line.number, text: 'Add a path line before this header.' }];
        const header = line.text.trim();
        if (header.startsWith(DETACH_PREFIX)) return [];
        if (!HTTP_HEADER_LINE.test(header)) return [{ number: line.number, text: 'Write this header as Name: value.' }];
        const colon = header.indexOf(':');
        block.headers.push({
            name: header.slice(0, colon).toLowerCase(),
            value: header.slice(colon + 1).trim(),
        });
        return [];
    });
    return { blocks, errors };
}

// The required security headers that the block for every path does not set.
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

/**
 * Checks that each redirect holds a source, a destination, and an optional Cloudflare status.
 *
 * @param text the _redirects file.
 * @returns the errors, each with its line.
 */
function validateRedirects(text: string): NumberedLine[] {
    const entries = splitContentLines(text);
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.minimum || parts.length > REDIRECT_PARTS.maximum)
            return [
                { number: line.number, text: 'Write a redirect as a source, a destination, and an optional status.' },
            ];
        if (!PATH_PREFIXES.some((prefix) => source.startsWith(prefix)))
            return [{ number: line.number, text: 'Start the redirect source with / or https://.' }];
        if (status === undefined) return [];
        const isKnown = REDIRECT_STATUS_CODES.has(status);
        return isKnown
            ? []
            : [{ number: line.number, text: `Use a supported Cloudflare redirect status instead of ${status}.` }];
    });
}

/**
 * Reports syntax errors in each _redirects file.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkCloudflareRedirects(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [REDIRECTS_FILE]).flatMap((path) =>
        validateRedirects(readCachedText(session.reads, path)).map((entry) =>
            buildFinding(planned, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * Reports syntax errors in each _headers file, and each security header that the block for every path does not set.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export function checkCloudflareHeaders(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [HEADERS_FILE]).flatMap((path) => {
        const { blocks, errors } = parseHeadersFile(readCachedText(session.reads, path));
        return [
            ...errors.map((entry) => buildFinding(planned, { file: path, line: entry.number }, 'syntax', entry.text)),
            ...listMissingHeaders(blocks).map((name) =>
                buildFinding(
                    planned,
                    { file: path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            ),
        ];
    });
}
