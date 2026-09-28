import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { parse as parseToml } from 'smol-toml';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { type ParseError, parse as parseJsonc } from 'jsonc-parser';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';

import {
    TYPES_FILE,
    STATUS_CODES,
    REDIRECT_PARTS,
    HTTP_HEADER_LINE,
    COMPATIBILITY_DATE,
} from '#cli/config/checks/checks.ts';

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
        headerProblems(lines(input, path)).map((entry) => ({
            check: input.spec.name,
            file: path,
            line: entry.number,
            rule: 'headers-syntax',
            message: entry.text,
            fixable: false,
        })),
    );
}

/**
 * The syntax findings of every redirects file.
 * @param input the engine input
 * @returns the findings
 */
export function redirectsSyntax(input: EngineInput): Finding[] {
    return named(input, '_redirects').flatMap((path) =>
        redirectProblems(lines(input, path)).map((entry) => ({
            check: input.spec.name,
            file: path,
            line: entry.number,
            rule: 'redirects-syntax',
            message: entry.text,
            fixable: false,
        })),
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
        if (problem !== undefined)
            return [{ check: input.spec.name, file: path, line: 1, rule: 'parse', message: problem, fixable: false }];
        const unnamed =
            typeof table['name'] === 'string'
                ? []
                : [
                      {
                          check: input.spec.name,
                          file: path,
                          line: 1,
                          rule: 'name',
                          message: 'The configuration names no worker.',
                          fixable: false,
                      },
                  ];
        const date = table['compatibility_date'];
        const undated =
            typeof date === 'string' && COMPATIBILITY_DATE.test(date)
                ? []
                : [
                      {
                          check: input.spec.name,
                          file: path,
                          line: 1,
                          rule: 'compatibility-date',
                          message:
                              'The configuration pins no compatibility_date, so the runtime behavior changes under it.',
                          fixable: false,
                      },
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
    const scratch = await scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const isolated = { ...input, root: scratch, scopeRoot: join(scratch, input.scope) };
    try {
        const findings: Finding[] = [];
        for (const path of paths)
            if (await isTypesFileStale(isolated, path))
                findings.push({
                    check: input.spec.name,
                    file: path,
                    line: 1,
                    rule: 'stale-types',
                    message: 'wrangler types writes this file differently. Run it and commit the result.',
                    fixable: false,
                });
        return findings;
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}
