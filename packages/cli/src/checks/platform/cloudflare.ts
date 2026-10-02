import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { isRecord } from '#cli/platform/text.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { jsoncValue } from '#cli/repository/jsonc.ts';
import { readSource } from '#cli/repository/sources.ts';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Engine, Finding, EngineInput } from '#cli/types/execution/execution.ts';

import {
    TYPES_FILE,
    STATUS_CODES,
    REDIRECT_PARTS,
    HTTP_HEADER_LINE,
    COMPATIBILITY_DATE,
} from '#cli/config/checks/platform/cloudflare.ts';

function named(input: EngineInput, name: string): string[] {
    return input.files
        .map((file) => file.path)
        .filter(
            (path) =>
                scopeOf(path, input.scopeEntries).path === input.scope && (path === name || path.endsWith(`/${name}`)),
        );
}

function lines(input: EngineInput, path: string): { text: string; number: number }[] {
    return readSource(input.root, path, input.reads)
        .toString('utf8')
        .split('\n')
        .map((text, index) => ({ text, number: index + 1 }))
        .filter((line) => line.text.trim() !== '' && !line.text.trimStart().startsWith('#'));
}

function headerProblem(line: { text: string; number: number }, hasPath: boolean): { number: number; text: string }[] {
    if (!hasPath) return [{ number: line.number, text: 'This header sits under no path.' }];
    const header = line.text.trim();
    const isHeader = HTTP_HEADER_LINE.test(header) || header.startsWith('! ');
    return isHeader ? [] : [{ number: line.number, text: 'This line is no header: a name, a colon, and a value.' }];
}

// The parsed configuration under table, or why it does not parse under problem.
function wranglerTable(
    input: EngineInput,
    path: string,
): { table: Record<string, unknown>; problem: string | undefined } {
    const text = readSource(input.root, path, input.reads).toString('utf8');
    try {
        if (path.endsWith('.toml')) return { table: parseToml(text), problem: undefined };
        const parsed = jsoncValue(text);
        return isRecord(parsed)
            ? { table: parsed, problem: undefined }
            : { table: {}, problem: 'The file does not parse as JSON with comments.' };
    } catch (error) {
        return { table: {}, problem: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

// Compares a copied types file with the output of wrangler in the same isolated directory.
async function isStale(input: EngineInput, path: string): Promise<boolean> {
    const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    const before = readSource(input.root, path, input.reads);
    const result = await runCheckCommand(input, ['wrangler', 'types', TYPES_FILE], {
        cwd: join(input.root, folder),
    });
    if (result.code !== 0)
        throw new Error(`The wrangler types command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    return !before.equals(readSource(input.root, path, input.reads));
}

/**
 * The problems of one headers file: a header line under no path, and an indented line that is no header.
 * @param entries the lines that hold something, with their numbers
 * @returns the problems, each with its line
 */
function headerProblems(entries: { text: string; number: number }[]): { number: number; text: string }[] {
    let hasPath = false;
    return entries.flatMap((line) => {
        if (/^\s/u.test(line.text)) return headerProblem(line, hasPath);
        hasPath = true;
        const isPath = line.text.startsWith('/') || line.text.startsWith('https://');
        return isPath
            ? []
            : [
                  {
                      number: line.number,
                      text: 'A block starts with a path that begins with a slash, or a full address.',
                  },
              ];
    });
}

/**
 * The problems of one redirects file: each rule is a source, a destination, and an optional status Cloudflare knows.
 * @param entries the lines that hold something, with their numbers
 * @returns the problems, each with its line
 */
function redirectProblems(entries: { text: string; number: number }[]): { number: number; text: string }[] {
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
 * The syntax findings of every redirects file.
 * @param input the engine input
 * @returns the findings
 */
function redirects(input: EngineInput): Finding[] {
    return named(input, '_redirects').flatMap((path) =>
        redirectProblems(lines(input, path)).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * Every wrangler configuration parses, names the worker, and pins a compatibility date.
 * @param input the engine input
 * @returns the findings
 */
function wrangler(input: EngineInput): Finding[] {
    const paths = ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc'].flatMap((name) => named(input, name));
    return paths.flatMap((path): Finding[] => {
        const { table, problem } = wranglerTable(input, path);
        if (problem !== undefined) return [findingAt(input, { file: path, line: 1 }, 'syntax', problem)];
        const unnamed =
            typeof table['name'] === 'string'
                ? []
                : [findingAt(input, { file: path, line: 1 }, 'missing-name', 'The configuration names no worker.')];
        const date = table['compatibility_date'];
        const undated =
            typeof date === 'string' && COMPATIBILITY_DATE.test(date)
                ? []
                : [
                      findingAt(
                          input,
                          { file: path, line: 1 },
                          'compatibility-date',
                          'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
                      ),
                  ];
        return [...unnamed, ...undated];
    });
}
/**
 * The syntax findings of every headers file.
 * @param input the engine input
 * @returns the findings
 */
export function headers(input: EngineInput): Finding[] {
    return named(input, '_headers').flatMap((path) =>
        headerProblems(lines(input, path)).map((entry) =>
            findingAt(input, { file: path, line: entry.number }, 'syntax', entry.text),
        ),
    );
}

/**
 * A tracked environment types file matches what wrangler writes. An ignored one is written by the build and is left alone.
 * @param input the engine input
 * @returns the findings
 */
export async function typesFresh(input: EngineInput): Promise<Finding[]> {
    const paths = named(input, TYPES_FILE);
    if (paths.length === 0) return [];
    using scratchFolder = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    const findings: Finding[] = [];
    for (const path of paths)
        if (await isStale(isolated, path))
            findings.push(
                findingAt(
                    input,
                    { file: path, line: 1 },
                    'stale',
                    'wrangler types writes this file differently. Run it and commit the result.',
                ),
            );
    return findings;
}

/** The analyses this file provides, by the name a manifest check gives them. */
export const ANALYSES: Record<string, Engine> = {
    'cloudflare/headers': headers,
    'cloudflare/redirects': redirects,
    'cloudflare/wrangler': wrangler,
    'cloudflare/types-fresh': typesFresh,
};
