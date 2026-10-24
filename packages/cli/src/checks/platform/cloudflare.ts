import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { type Finding } from '#cli/types/runs/check.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { listSourcePaths } from '#cli/repository/files/selection.ts';
import type { HeaderBlock, ParsedHeadersFile } from '#cli/types/checks/platform/cloudflare.ts';

import {
    HEADERS_FILE,
    DETACH_PREFIX,
    PATH_PREFIXES,
    REDIRECTS_FILE,
    REDIRECT_FIELDS,
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
    const contentLines = splitContentLines(text);
    return contentLines.flatMap((line) => {
        const segments = line.text.trim().split(/\s+/u);
        const [source = '', , status] = segments;
        if (segments.length < REDIRECT_FIELDS.minimum || segments.length > REDIRECT_FIELDS.maximum)
            return [
                { number: line.number, text: 'Write a redirect as a source, a destination, and an optional status.' },
            ];
        if (!PATH_PREFIXES.some((prefix) => source.startsWith(prefix)))
            return [{ number: line.number, text: 'Start the redirect source with / or https://.' }];
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
@returns the findings.
*/
export function checkCloudflareRedirects(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [REDIRECTS_FILE]).flatMap((path) =>
        validateRedirects(readCachedText(session.reads, path)).map((invalidLine) =>
            buildFinding(planned, { file: path, line: invalidLine.number }, 'syntax', invalidLine.text),
        ),
    );
}

/**
Reports syntax errors in each _headers file, and each security header that the block for every path does not set.

@param session the repository and its tools.
@param planned the scope files to read.
@returns the findings.
*/
export function checkCloudflareHeaders(session: Session, planned: PlannedCheck): Finding[] {
    return listSourcePaths(planned.files, [HEADERS_FILE]).flatMap((path) => {
        const { blocks, errors } = parseHeadersFile(readCachedText(session.reads, path));
        return [
            ...errors.map((error) => buildFinding(planned, { file: path, line: error.number }, 'syntax', error.text)),
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
