import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { LFS_FILTER } from '#cli/config/repository/inventory.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';

/**
 * Reports each tracked file over `repository.max_file_kilobytes`, except generated, vendored, and Git Large File Storage (LFS) files.
 * @param input the tracked files and size limit.
 * @returns the findings.
 */
export function checkLargeFiles(input: CheckInput): Finding[] {
    const limitKilobytes = input.selection.view.options('repository').max_file_kilobytes;
    return input.repositoryFiles
        .filter(
            (file) =>
                file.kind !== 'generated' &&
                file.kind !== 'vendored' &&
                file.size > limitKilobytes * BYTES_PER_KILOBYTE &&
                input.attributes.get(file.path)?.['filter'] !== LFS_FILTER,
        )
        .map((file) =>
            buildFinding(
                input,
                { file: file.path, line: 1 },
                'size',
                `${String(Math.round(file.size / BYTES_PER_KILOBYTE))} kB is over the ${String(limitKilobytes)} kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.`,
            ),
        );
}

/**
 * Reports indexed files that the scope configurations mark as untracked.
 * @param input the Git index and each scope.
 * @returns the findings.
 */
export function checkLocalFiles(input: CheckInput): Finding[] {
    const scopes = input.selections.map(({ scope }) => scope);
    const matchers = input.selections.map(({ scope, selected, view }) => {
        const matches = buildPathMatcher(
            selected.flatMap((manifest) => manifest.ignored_folders.map((name) => `**/${name}/**`)),
        );
        const examples = new Set(view.options('secrets').env_examples);
        const hasSecrets = selected.some((manifest) => manifest.configuration.name === 'secrets');
        return {
            scope,
            matches: (path: string) => {
                const name = posix.basename(path);
                const environmentFile =
                    name === '.env' ||
                    name.startsWith('.env.') ||
                    name === '.dev.vars' ||
                    name.startsWith('.dev.vars.');
                return matches(path) || (hasSecrets && environmentFile && !examples.has(name));
            },
        };
    });
    return [...new Set(input.index.map(({ path }) => path))]
        .filter((path) =>
            matchers.some(
                ({ scope, matches }) =>
                    findScope(path, scopes).path === scope.path && matches(posix.relative(scope.path, path)),
            ),
        )
        .map((path) =>
            buildFinding(
                input,
                { file: path, line: 1 },
                'tracked-file',
                `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
            ),
        );
}
