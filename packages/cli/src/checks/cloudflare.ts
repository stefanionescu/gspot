// The files Cloudflare reads by name: the headers file, the redirects file, the wrangler configuration, and the generated environment types.
import { join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { parse as parseToml } from 'smol-toml';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';

const HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;
const STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308', '404', '410']);
const COMPATIBILITY_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TYPES_FILE = 'cloudflare-env.d.ts';
const TYPES_TIMEOUT_MS = 300_000;
const REDIRECT_PARTS = { least: 2, most: 3 };

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

function named(input: EngineInput, name: string): string[] {
    return input.session.repository.files
        .map((file) => file.path)
        .filter((path) => path === name || path.endsWith(`/${name}`));
}

function lines(input: EngineInput, path: string): { text: string; number: number }[] {
    return readFileSync(join(input.root, path), 'utf8')
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

function blockProblem(line: { text: string; number: number }): { number: number; text: string }[] {
    const isPath = line.text.startsWith('/') || line.text.startsWith('https://');
    return isPath
        ? []
        : [{ number: line.number, text: 'A block starts with a path that begins with a slash, or a full address.' }];
}

function headerProblem(line: { text: string; number: number }, hasPath: boolean): { number: number; text: string }[] {
    if (!hasPath) return [{ number: line.number, text: 'This header sits under no path.' }];
    const header = line.text.trim();
    const isHeader = HEADER_LINE.test(header) || header.startsWith('! ');
    return isHeader ? [] : [{ number: line.number, text: 'This line is no header: a name, a colon, and a value.' }];
}

// The parsed configuration under table, or why it does not parse under problem.
function wranglerTable(
    input: EngineInput,
    path: string,
): { table: Record<string, unknown>; problem: string | undefined } {
    const text = readFileSync(join(input.root, path), 'utf8');
    try {
        if (path.endsWith('.toml')) return { table: parseToml(text), problem: undefined };
        const errors: ParseError[] = [];
        const parsed = parseJsonc(text, errors) as Record<string, unknown> | undefined;
        const isBroken = parsed === undefined || errors.length > 0;
        return {
            table: parsed ?? {},
            problem: isBroken ? 'The file does not parse as JSON with comments.' : undefined,
        };
    } catch (error) {
        return { table: {}, problem: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

// Runs wrangler types over one tracked file, puts the committed text back, and says whether the two differ.
async function isTypesFileStale(input: EngineInput, path: string): Promise<boolean> {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const binary = locateTool(join(input.root, folder), 'wrangler') ?? locateTool(input.root, 'wrangler');
    if (binary === undefined) throw new MissingToolError('The wrangler command is not installed.');
    const full = join(input.root, path);
    const before = readFileSync(full, 'utf8');
    const result = await run([binary, 'types', TYPES_FILE], {
        cwd: join(input.root, folder),
        timeoutMs: TYPES_TIMEOUT_MS,
    });
    const after = existsSync(full) ? readFileSync(full, 'utf8') : '';
    writeFileSync(full, before);
    if (result.code !== 0)
        throw new Error(`The wrangler types command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return after !== before;
}

/**
 * The problems of one headers file: a header line under no path, and an indented line that is no header.
 * @param entries the lines that hold something, with their numbers
 * @returns the problems, each with its line
 */
export function headerProblems(entries: { text: string; number: number }[]): { number: number; text: string }[] {
    let hasPath = false;
    return entries.flatMap((line) => {
        if (/^\s/u.test(line.text)) return headerProblem(line, hasPath);
        hasPath = true;
        return blockProblem(line);
    });
}

/**
 * The problems of one redirects file: each rule is a source, a destination, and an optional status Cloudflare knows.
 * @param entries the lines that hold something, with their numbers
 * @returns the problems, each with its line
 */
export function redirectProblems(entries: { text: string; number: number }[]): { number: number; text: string }[] {
    return entries.flatMap((line) => {
        const parts = line.text.trim().split(/\s+/u);
        const [source = '', , status] = parts;
        if (parts.length < REDIRECT_PARTS.least || parts.length > REDIRECT_PARTS.most)
            return [{ number: line.number, text: 'A redirect is a source, a destination, and an optional status.' }];
        if (!source.startsWith('/') && !source.startsWith('https://'))
            return [{ number: line.number, text: 'The source begins with a slash, or is a full address.' }];
        if (status === undefined) return [];
        const isKnown = STATUS_CODES.has(status.replace(/!$/u, ''));
        return isKnown ? [] : [{ number: line.number, text: `Cloudflare knows no redirect status ${status}.` }];
    });
}

/**
 * The syntax findings of every headers file.
 * @param input the engine input
 * @returns the findings
 */
export function headersSyntax(input: EngineInput): Promise<Finding[]> {
    const found = named(input, '_headers').flatMap((path) =>
        headerProblems(lines(input, path)).map((entry) =>
            finding(input, path, entry.number, 'headers-syntax', entry.text),
        ),
    );
    return Promise.resolve(found);
}

/**
 * The syntax findings of every redirects file.
 * @param input the engine input
 * @returns the findings
 */
export function redirectsSyntax(input: EngineInput): Promise<Finding[]> {
    const found = named(input, '_redirects').flatMap((path) =>
        redirectProblems(lines(input, path)).map((entry) =>
            finding(input, path, entry.number, 'redirects-syntax', entry.text),
        ),
    );
    return Promise.resolve(found);
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the engine input
 * @returns the findings
 */
export function wranglerFile(input: EngineInput): Promise<Finding[]> {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => named(input, name));
    const found = paths.flatMap((path): Finding[] => {
        const { table, problem } = wranglerTable(input, path);
        if (problem !== undefined) return [finding(input, path, 1, 'parse', problem)];
        const unnamed =
            typeof table['name'] === 'string'
                ? []
                : [finding(input, path, 1, 'name', 'The configuration names no worker.')];
        const date = table['compatibility_date'];
        const undated =
            typeof date === 'string' && COMPATIBILITY_DATE.test(date)
                ? []
                : [
                      finding(
                          input,
                          path,
                          1,
                          'compatibility-date',
                          'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
                      ),
                  ];
        return [...unnamed, ...undated];
    });
    return Promise.resolve(found);
}

/**
 * A tracked environment types file matches what wrangler writes. An ignored one is written by the build and is left alone.
 * @param input the engine input
 * @returns the findings
 */
export async function envTypesFresh(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const path of named(input, TYPES_FILE))
        if (await isTypesFileStale(input, path))
            findings.push(
                finding(
                    input,
                    path,
                    1,
                    'stale-types',
                    'wrangler types writes this file differently. Run it and commit the result.',
                ),
            );
    return findings;
}
