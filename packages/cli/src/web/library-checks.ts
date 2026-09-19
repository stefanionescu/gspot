// Checks of two libraries that read files: what client code imports from the server, and Drizzle tables with their relations and migrations.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { git, run } from '#cli/platform/spawn.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';

// The source of an import statement that is no type import, read from a line that starts with import and holds its from.
const IMPORT_SOURCE = /from ['"](?<source>[^'"]+)['"]/u;
const PORCELAIN_PREFIX = 3;
const TABLE = /export const (?<name>\w+) = \w*[tT]able\(/gu;
const KIT_TIMEOUT_MS = 300_000;

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.id, file, line, rule, message: text, fixable: false };
}

function sources(input: EngineInput): { path: string; text: string }[] {
    return input.files
        .filter((file) => file.nature === 'source' && /\.tsx?$/u.test(file.path))
        .map((file) => ({ path: file.path, text: readFileSync(join(input.root, file.path), 'utf8') }));
}

function valueImports(text: string): { source: string; line: number }[] {
    return text.split('\n').flatMap((line, index) => {
        const isValue = line.startsWith('import ') && !line.startsWith('import type ');
        const source = isValue ? IMPORT_SOURCE.exec(line)?.groups?.['source'] : undefined;
        return source === undefined ? [] : [{ source, line: index + 1 }];
    });
}

function isServerSource(source: string, isServer: (path: string) => boolean): boolean {
    const bare = source.replace(/^[@~./]+/u, '');
    return isServer(`x/${bare}/x`) || source.split('/').includes('server');
}

// The SQL files git sees as new under the scope, which are the migrations drizzle-kit just wrote.
function untrackedSqlFiles(input: EngineInput): string[] {
    const listed =
        git(input.root, [
            'status',
            '--porcelain',
            '--untracked-files=all',
            '--',
            input.scope === '' ? '.' : input.scope,
        ]) ?? '';
    return listed
        .split('\n')
        .filter((line) => line.startsWith('??') && line.endsWith('.sql'))
        .map((line) => line.slice(PORCELAIN_PREFIX).trim());
}

function hasDrizzleFile(input: EngineInput): boolean {
    return input.session.repository.files.some(
        (file) =>
            file.path.startsWith(input.scope) &&
            file.path.slice(file.path.lastIndexOf('/') + 1).startsWith('drizzle.config.'),
    );
}

/**
 * One finding for each value import that reaches into the server paths from outside them.
 * @param input the engine input
 * @returns the findings
 */
export function trpcBoundaries(input: EngineInput): Promise<Finding[]> {
    const isServer = pathMatcher((input.view.tool('trpc')['server_paths'] as string[] | undefined) ?? ['**/server/**']);
    const found = sources(input)
        .filter((file) => !isServer(file.path))
        .flatMap((file) =>
            valueImports(file.text)
                .filter((entry) => isServerSource(entry.source, isServer))
                .map((entry) =>
                    finding(
                        input,
                        file.path,
                        entry.line,
                        'server-import',
                        `${entry.source} is server code. Import its types with import type.`,
                    ),
                ),
        );
    return Promise.resolve(found);
}

/**
 * One finding for each table that references another and has no relations entry anywhere in the scope.
 * @param input the engine input
 * @returns the findings
 */
export function drizzleRelations(input: EngineInput): Promise<Finding[]> {
    const files = sources(input);
    const everything = files.map((file) => file.text).join('\n');
    const found = files.flatMap((file) =>
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
    return Promise.resolve(found);
}

/**
 * Asks drizzle-kit for migrations and reports the files it writes, then takes them out again.
 * @param input the engine input
 * @returns the findings
 */
export async function drizzleMigrations(input: EngineInput): Promise<Finding[]> {
    if (!hasDrizzleFile(input)) return [];
    const cwd = join(input.root, input.scope);
    const binary = locateTool(cwd, 'drizzle-kit') ?? locateTool(input.root, 'drizzle-kit');
    if (binary === undefined) throw new Error('The drizzle-kit command is not installed.');
    const result = await run([binary, 'generate'], { cwd, timeoutMs: KIT_TIMEOUT_MS });
    if (result.code !== 0)
        throw new Error(`The drizzle-kit generate command failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const written = untrackedSqlFiles(input);
    for (const path of written) git(input.root, ['clean', '-fq', '--', path]);
    return written.map((path) =>
        finding(
            input,
            path,
            1,
            'missing-migration',
            'drizzle-kit writes this migration, so the schema changed and no migration was committed.',
        ),
    );
}
