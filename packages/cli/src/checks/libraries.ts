import { rmSync } from 'node:fs';
import { globbySync } from 'globby';
import { scratchCopy } from '#cli/run/fixers.ts';
// Checks of two libraries that read files: what client code imports from the server, and Drizzle tables with their relations and migrations.
import { basename, dirname, join } from 'node:path';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { scopeImports } from '#cli/structure/imports.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { pathMatcher } from '#cli/configurations/claims.ts';
import type { ArchitectureElement } from '#cli/policy/normalize.ts';

const TABLE = /export const (?<name>\w+) = \w*[tT]able\(/gu;

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
}

function sources(input: EngineInput): { path: string; text: string }[] {
    return input.files
        .filter((file) => file.nature === 'source' && /\.tsx?$/u.test(file.path))
        .map((file) => ({
            path: file.path,
            text: readSource(input.root, file.path, input.observations).toString('utf8'),
        }));
}

function generatedContents(cwd: string): Map<string, Buffer> {
    const paths = globbySync(['**/*', '!**/node_modules/**', '!**/.venv/**', '!**/.gspot/**'], {
        cwd,
        dot: true,
        followSymbolicLinks: false,
    });
    return new Map(paths.map((path) => [path, readSource(cwd, path)]));
}

function hasDrizzleFile(input: EngineInput): boolean {
    return input.files.some(
        (file) => dirname(file.path) === (input.scope || '.') && basename(file.path).startsWith('drizzle.config.'),
    );
}

/**
 * One finding for each value import that reaches into the server paths from outside them.
 * @param input the engine input
 * @returns the findings
 */
export async function trpcBoundaries(input: EngineInput): Promise<Finding[]> {
    const elements = (input.view.settings['architecture.elements'] ?? []) as ArchitectureElement[];
    const server = elements.find((element) => element.name === 'server');
    const isServer = pathMatcher(server?.paths ?? (input.view.tool('trpc')['server_files'] as string[]));
    const local = (path: string): string => (input.scope === '' ? path : path.slice(input.scope.length + 1));
    const index = await scopeImports(input);
    return index.edges
        .filter((edge) => !isServer(local(edge.from)) && isServer(local(edge.to)))
        .map((edge) => ({
            ...finding(
                input,
                edge.from,
                edge.line,
                'server-import',
                `${edge.source} is server code. Import its types with import type.`,
            ),
            column: edge.column,
        }));
}

/**
 * One finding for each table that references another and has no relations entry anywhere in the scope.
 * @param input the engine input
 * @returns the findings
 */
export function drizzleRelations(input: EngineInput): Finding[] {
    const files = sources(input);
    const everything = files.map((file) => file.text).join('\n');
    return files.flatMap((file) =>
        file.text
            .matchAll(TABLE)
            .filter((match) => {
                const name = match.groups?.['name'] ?? '';
                const next = file.text.indexOf('export const', match.index + 1);
                const body = next === -1 ? file.text.slice(match.index) : file.text.slice(match.index, next);
                return (
                    body.includes('.references(') &&
                    !new RegExp(String.raw`relations\(\s*${name}\b`, 'u').test(everything)
                );
            })
            .map((match) =>
                finding(
                    input,
                    file.path,
                    file.text.slice(0, match.index).split('\n').length,
                    'relations',
                    `${match.groups?.['name'] ?? ''} references another table and has no relations entry.`,
                ),
            )
            .toArray(),
    );
}

/**
 * Generates migrations in an isolated copy and reports changed output.
 * @param input the engine input
 * @returns the findings
 */
export async function drizzleMigrations(input: EngineInput): Promise<Finding[]> {
    if (!hasDrizzleFile(input)) return [];
    const scratch = scratchCopy(
        input.root,
        input.files.map((file) => file.path),
        input.scopeEntries.map((scope) => scope.path),
    );
    const isolated = join(scratch, input.scope);
    try {
        const before = generatedContents(isolated);
        const result = await runCheckCommand(input, ['drizzle-kit', 'generate'], { cwd: isolated });
        if (result.code !== 0)
            throw new Error(
                `The drizzle-kit generate command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
            );
        const after = generatedContents(isolated);
        const changed = [...new Set([...before.keys(), ...after.keys()])]
            .filter((path) => {
                const was = before.get(path);
                const now = after.get(path);
                return was === undefined || now === undefined || !was.equals(now);
            })
            .toSorted();
        return changed.map((path) =>
            finding(
                input,
                input.scope === '' ? path : `${input.scope}/${path}`,
                1,
                'missing-migration',
                'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
            ),
        );
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
