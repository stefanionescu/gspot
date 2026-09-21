// Checks of two libraries that read files: what client code imports from the server, and Drizzle tables with their relations and migrations.
import { basename, dirname, join } from 'node:path';
import { globbySync } from 'globby';
import { readFileSync, rmSync } from 'node:fs';
import { scratchCopy } from '#cli/run/scratch-copy.ts';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { run } from '#cli/platform/spawn.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

// The source of an import statement that is no type import, read from a line that starts with import and holds its from.
const IMPORT_SOURCE = /from ['"](?<source>[^'"]+)['"]/u;
const TABLE = /export const (?<name>\w+) = \w*[tT]able\(/gu;
const KIT_TIMEOUT_MS = 300_000;

function finding(input: EngineInput, file: string, line: number, rule: string, text: string): Finding {
    return { check: input.spec.name, file, line, rule, message: text, fixable: false };
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

function generatedContents(cwd: string): Map<string, Buffer> {
    const paths = globbySync(['**/*', '!**/node_modules/**', '!**/.venv/**', '!**/.gspot/**'], {
        cwd,
        dot: true,
        followSymbolicLinks: false,
    });
    return new Map(paths.map((path) => [path, readFileSync(join(cwd, path))]));
}

function hasDrizzleFile(input: EngineInput): boolean {
    return input.session.repository.files.some(
        (file) => dirname(file.path) === (input.scope || '.') && basename(file.path).startsWith('drizzle.config.'),
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
 * Generates migrations in an isolated copy and reports changed output.
 * @param input the engine input
 * @returns the findings
 */
export async function drizzleMigrations(input: EngineInput): Promise<Finding[]> {
    if (!hasDrizzleFile(input)) return [];
    const cwd = join(input.root, input.scope);
    const binary = locateTool(cwd, 'drizzle-kit') ?? locateTool(input.root, 'drizzle-kit');
    if (binary === undefined) throw new MissingToolError('The drizzle-kit command is not installed.');
    const scratch = scratchCopy(
        input.session,
        input.session.repository.files.map((file) => file.path),
    );
    const isolated = join(scratch, input.scope);
    try {
        const before = generatedContents(isolated);
        const result = await run([binary, 'generate'], { cwd: isolated, timeoutMs: KIT_TIMEOUT_MS });
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
