import { rm } from 'node:fs/promises';
import { findingAt } from '#cli/checks/result.ts';
import { globPaths } from '#cli/platform/paths.ts';
import { join, dirname, basename } from 'node:path';
import { readSource } from '#cli/repository/sources.ts';
import { TABLE } from '#cli/config/checks/repository.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import type { Engine, Finding, EngineInput } from '#cli/types/checks.ts';

function generatedContents(cwd: string): Map<string, Buffer> {
    const paths = globPaths(cwd, ['**/*', '!**/node_modules/**', '!**/.venv/**', '!**/.gspot/**'], { dot: true });
    return new Map(paths.map((path) => [path, readSource(cwd, path)]));
}

/**
 * One finding for each table that references another and has no relations entry anywhere in the scope.
 * @param input the engine input
 * @returns the findings
 */
function drizzleRelations(input: EngineInput): Finding[] {
    const files = input.files
        .filter((file) => file.kind === 'source' && /\.tsx?$/u.test(file.path))
        .map((file) => ({
            path: file.path,
            text: readSource(input.root, file.path, input.reads).toString('utf8'),
        }));
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
                findingAt(
                    input,
                    { file: file.path, line: file.text.slice(0, match.index).split('\n').length },
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
    if (
        !input.files.some(
            (file) => dirname(file.path) === (input.scope || '.') && basename(file.path).startsWith('drizzle.config.'),
        )
    )
        return [];
    const scratch = await scratchCopy(
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
            .toSorted((left, right) => left.localeCompare(right));
        return changed.map((path) =>
            findingAt(
                input,
                { file: input.scope === '' ? path : `${input.scope}/${path}`, line: 1 },
                'missing-migration',
                'drizzle-kit changes this file when generating migrations; regenerate and commit the migration output.',
            ),
        );
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}

/** The analyses this file provides, by the name a manifest check gives them. */
export const DRIZZLE_ANALYSES: Record<string, Engine> = {
    'drizzle-relations': drizzleRelations,
    'drizzle-migrations': drizzleMigrations,
};
