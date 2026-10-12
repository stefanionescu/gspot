import { isRecord } from '#cli/objects.ts';
import { createRequire } from 'node:module';
import { parse as parseToml } from 'smol-toml';
import { parseJsonc } from '#cli/parsers/json.ts';
import type { Parsed } from '#cli/types/errors.ts';
import { join, dirname, relative } from 'node:path';
import { readSource } from '#cli/system/file-reads.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { parseOutput } from '#cli/parsers/output/formats.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { findingAt, sourcePaths } from '#cli/checks/finding.ts';
import { toolFindings } from '#cli/execution/command/output.ts';
import { toolDeclaration } from '#cli/configurations/tool-pins.ts';
import { inspectTool, toolAvailability } from '#cli/tools/find.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import type { HeaderBlock, HeaderBlocks } from '#cli/types/checks/platform.ts';

import {
    DETACH_PREFIX,
    REDIRECT_PARTS,
    REDIRECTS_FILE,
    WRANGLER_FILES,
    FRAME_ANCESTORS,
    SOURCE_PREFIXES,
    WRANGLER_FIELDS,
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
 * Parse a Wrangler document without repository I/O.
 * @param text the document contents.
 * @param path the document path for selecting TOML or JSON with comments.
 * @returns the parsed object or its syntax diagnostic.
 */
function parseWrangler(text: string, path: string): Parsed<Record<string, unknown>> {
    try {
        if (path.endsWith('.toml')) return { value: parseToml(text) };
        const parsed = parseJsonc(text);
        return isRecord(parsed) ? { value: parsed } : { error: 'The file does not parse as JSON with comments.' };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'The file does not parse.' };
    }
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
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the check input.
 * @returns the findings.
 */
export async function cloudflareWrangler(input: CheckInput): Promise<Finding[]> {
    const paths = WRANGLER_FILES.flatMap((name) => sourcePaths(input, [name]));
    const wrangler = toolDeclaration(input.manifests.values(), 'wrangler');
    const context = {
        ...input,
        cwd: join(
            input.installedRoot ?? input.root,
            relative(input.root, join(input.root, input.selection.scope.path)),
        ),
    };
    const executable = toolAvailability(wrangler, inspectTool(context, wrangler));
    if ('status' in executable) throw new Error(executable.note);
    const schema = join(dirname(createRequire(executable.path).resolve('wrangler/package.json')), 'config-schema.json');
    const result = await runCheckTool(
        input,
        (input.check.command as string[]).flatMap((part) =>
            part === '{files}' ? paths : [part === '{wrangler_schema}' ? schema : part],
        ),
        { cwd: input.root },
    );
    const schemaFindings = parseOutput(input.check, result.stdout, result.stderr, {
        root: input.root,
        cwd: input.root,
    });
    return [
        ...toolFindings(result, schemaFindings, 'v8r'),
        ...paths.flatMap((path): Finding[] => {
            const read = parseWrangler(readSource(input.root, path, input.reads).toString('utf8'), path);
            if ('error' in read) return [findingAt(input, { file: path, line: 1 }, 'syntax', read.error)];
            const missing = Object.entries(WRANGLER_FIELDS).flatMap(([field, { pattern, rule, message }]) => {
                const value = read.value[field];
                return typeof value === 'string' && pattern.test(value) ? [] : [{ rule, message }];
            });
            return missing.map(({ rule, message }) => findingAt(input, { file: path, line: 1 }, rule, message));
        }),
    ];
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
