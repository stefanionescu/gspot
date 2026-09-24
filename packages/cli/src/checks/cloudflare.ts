// The files Cloudflare reads by name: the headers file, the redirects file, the wrangler configuration, and the generated environment types.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import { scratchCopy } from '#cli/run/fixers.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/reports.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import type { EngineInput } from '#cli/types/execution.ts';
import { parse as parseJsonc, type ParseError } from 'jsonc-parser';

const HEADER_LINE = /^[A-Za-z!][\w!#$%&'*+.^`|~-]*:\s*\S/u;
const STATUS_CODES = new Set(['200', '301', '302', '303', '307', '308', '404', '410']);
const COMPATIBILITY_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TYPES_FILE = 'cloudflare-env.d.ts';
const REDIRECT_PARTS = { least: 2, most: 3 };

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

function named(input: EngineInput, name: string): string[] {
    return input.files
        .map((file) => file.path)
        .filter(
            (path) =>
                scopeOf(path, input.scopeEntries).path === input.scope && (path === name || path.endsWith(`/${name}`)),
        );
}

function lines(input: EngineInput, path: string): { text: string; number: number }[] {
    return readSource(input.root, path, input.observations)
        .toString('utf8')
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
    const text = readSource(input.root, path, input.observations).toString('utf8');
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

// Compares a copied types file with the output of wrangler in the same isolated directory.
async function isTypesFileStale(input: EngineInput, path: string): Promise<boolean> {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const before = readSource(input.root, path, input.observations);
    const result = await runCheckCommand(input, ['wrangler', 'types', TYPES_FILE], {
        cwd: join(input.root, folder),
    });
    if (result.code !== 0)
        throw new Error(`The wrangler types command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return !before.equals(readSource(input.root, path, input.observations));
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
export function headersSyntax(input: EngineInput): Finding[] {
    return named(input, '_headers').flatMap((path) =>
        headerProblems(lines(input, path)).map((entry) =>
            finding(input, path, entry.number, 'headers-syntax', entry.text),
        ),
    );
}

/**
 * The syntax findings of every redirects file.
 * @param input the engine input
 * @returns the findings
 */
export function redirectsSyntax(input: EngineInput): Finding[] {
    return named(input, '_redirects').flatMap((path) =>
        redirectProblems(lines(input, path)).map((entry) =>
            finding(input, path, entry.number, 'redirects-syntax', entry.text),
        ),
    );
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the engine input
 * @returns the findings
 */
export function wranglerFile(input: EngineInput): Finding[] {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => named(input, name));
    return paths.flatMap((path): Finding[] => {
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
}

/**
 * A tracked environment types file matches what wrangler writes. An ignored one is written by the build and is left alone.
 * @param input the engine input
 * @returns the findings
 */
export async function envTypesFresh(input: EngineInput): Promise<Finding[]> {
    const paths = named(input, TYPES_FILE);
    if (paths.length === 0) return [];
    const scratch = scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    try {
        const findings: Finding[] = [];
        for (const path of paths)
            if (await isTypesFileStale(isolated, path))
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
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
