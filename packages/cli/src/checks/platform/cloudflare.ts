import { buildFinding } from '#cli/checks/finding.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/coverage.ts';
import type { HeaderBlock, HeaderBlocks } from '#cli/types/checks/platform.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';

import {
    DETACH_PREFIX,
    PATH_PREFIXES,
    REDIRECT_PARTS,
    REDIRECTS_FILE,
    FRAME_ANCESTORS,
    HTTP_HEADER_LINE,
    REQUIRED_HEADERS,
    REDIRECT_STATUS_CODES,
} from '#cli/config/checks/platform/cloudflare.ts';

function splitContentLines(text: string): NumberedLine[] {
    return text
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

/**
 * Read path blocks, their headers and syntax diagnostics with original line numbers.
 * @param text the complete _headers content before line parsing.
 * @returns the blocks and findings.
 */
function parseHeadersFile(text: string): HeaderBlocks {
    const blocks: HeaderBlock[] = [];
    const findings = splitContentLines(text).flatMap((line): NumberedLine[] => {
        if (!/^\s/u.test(line.text)) {
            blocks.push({ path: line.text.trim(), line: line.number, headers: [] });
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
function validateRedirects(text: string): NumberedLine[] {
    const entries = splitContentLines(text);
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.least || parts.length > REDIRECT_PARTS.most)
            return [{ number: line.number, text: 'A redirect is a source, a destination, and an optional status.' }];
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
 * The syntax findings of every redirects file.
 * @param input the selected redirect paths and cached text reads.
 * @returns the findings.
 */
export function checkCloudflareRedirects(input: CheckInput): Finding[] {
    return listSourcePaths(input.files, [REDIRECTS_FILE]).flatMap((path) =>
        validateRedirects(readCachedBytes(input.reads, path).toString('utf8')).map((entry) =>
            buildFinding(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}
/**
 * The syntax findings of every headers file.
 * @param input the selected header paths and cached text reads.
 * @returns the findings.
 */
export function checkCloudflareHeaders(input: CheckInput): Finding[] {
    return listSourcePaths(input.files, ['_headers']).flatMap((path) =>
        parseHeadersFile(readCachedBytes(input.reads, path).toString('utf8')).findings.map((entry) =>
            buildFinding(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * The headers file sets the security headers for every path.
 * @param input the header paths and file reads that supply the wildcard block.
 * @returns the findings.
 */
export function checkCloudflareSecurityHeaders(input: CheckInput): Finding[] {
    return listSourcePaths(input.files, ['_headers']).flatMap((path) => {
        const { blocks } = parseHeadersFile(readCachedBytes(input.reads, path).toString('utf8'));
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
                buildFinding(
                    input,
                    { file: path, line: 1 },
                    'missing-header',
                    `The block for /* sets no valid ${name} header.`,
                ),
            );
    });
}
