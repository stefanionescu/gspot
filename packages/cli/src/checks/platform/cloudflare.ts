import { readSource } from '#cli/system/file-reads.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import type { HeaderBlock, HeaderBlocks } from '#cli/types/checks/platform.ts';

import {
    DETACH_PREFIX,
    REDIRECT_PARTS,
    REDIRECTS_FILE,
    FRAME_ANCESTORS,
    SOURCE_PREFIXES,
    HTTP_HEADER_LINE,
    REQUIRED_HEADERS,
    REDIRECT_STATUS_CODES,
} from '#cli/config/checks/platform/cloudflare.ts';

function contentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

/**
 * Read path blocks, their headers and syntax diagnostics with original line numbers.
 * @param text the headers file.
 * @returns the blocks and findings.
 */
function parseHeadersFile(text: string): HeaderBlocks {
    const blocks: HeaderBlock[] = [];
    const findings = contentLines(text).flatMap((line): NumberedLine[] => {
        if (!/^\s/u.test(line.text)) {
            blocks.push({ path: line.text.trim(), line: line.number, headers: [] });
            return SOURCE_PREFIXES.some((prefix) => line.text.startsWith(prefix))
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
            line: line.number,
        });
        return [];
    });
    return { blocks, findings };
}

/**
 * The findings of one redirects file: each rule contains a source, a destination, and an optional Cloudflare status.
 * @param text the asset contents.
 * @returns the findings, each with its line.
 */
function redirectFindings(text: string): NumberedLine[] {
    const entries = contentLines(text);
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.least || parts.length > REDIRECT_PARTS.most)
            return [{ number: line.number, text: 'A redirect is a source, a destination, and an optional status.' }];
        if (!SOURCE_PREFIXES.some((prefix) => source.startsWith(prefix)))
            return [{ number: line.number, text: 'Start the redirect source with / or https://.' }];
        if (status === undefined) return [];
        const isKnown = REDIRECT_STATUS_CODES.has(status);
        return isKnown
            ? []
            : [{ number: line.number, text: `Use a supported Cloudflare redirect status instead of ${status}.` }];
    });
}

/**
 * The syntax findings of every redirects file.
 * @param input the check input.
 * @returns the findings.
 */
export function cloudflareRedirects(input: CheckInput): Finding[] {
    return sourcePaths(input, [REDIRECTS_FILE]).flatMap((path) =>
        redirectFindings(readSource(input.root, path, input.reads).toString('utf8')).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}
/**
 * The syntax findings of every headers file.
 * @param input the check input.
 * @returns the findings.
 */
export function cloudflareHeaders(input: CheckInput): Finding[] {
    return sourcePaths(input, ['_headers']).flatMap((path) =>
        parseHeadersFile(readSource(input.root, path, input.reads).toString('utf8')).findings.map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * The headers file sets the security headers for every path.
 * @param input the check input.
 * @returns the findings.
 */
export function cloudflareSecurityHeaders(input: CheckInput): Finding[] {
    return sourcePaths(input, ['_headers']).flatMap((path) => {
        const { blocks } = parseHeadersFile(readSource(input.root, path, input.reads).toString('utf8'));
        const held = new Map(
            blocks
                .filter((block) => block.path === '/*')
                .flatMap((block) => block.headers.map(({ name, value }) => [name, value])),
        );
        const hasFrameRule = FRAME_ANCESTORS.test(held.get('content-security-policy') ?? '');
        return Object.entries(REQUIRED_HEADERS)
            .filter(
                ([name, pattern]) =>
                    !pattern.test(held.get(name) ?? '') && !(name === 'x-frame-options' && hasFrameRule),
            )
            .map(([name]) =>
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            );
    });
}
