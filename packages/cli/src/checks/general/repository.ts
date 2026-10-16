import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { BYTES_PER_KB } from '#cli/config/units.ts';
import { findScope } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { LFS_FILTER } from '#cli/config/repository/inventory.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

/**
 * One finding per tracked file over `limits.file_kilobytes` outside generated, vendored, and Git Large File Storage paths.
 * @param input the check input.
 * @returns the findings.
 */
export function largeFiles(input: CheckInput): Finding[] {
    const limitKilobytes = input.scope.view.limit('file_kilobytes');
    return input.repositoryFiles
        .filter(
            (file) =>
                file.kind !== 'generated' &&
                file.kind !== 'vendored' &&
                file.size > limitKilobytes * BYTES_PER_KB &&
                input.attributes.get(file.path)?.['filter'] !== LFS_FILTER,
        )
        .map((file) =>
            findingAt(
                input,
                { file: file.path, line: 1 },
                'size',
                `${String(Math.round(file.size / BYTES_PER_KB))} kB is over the ${String(limitKilobytes)} kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.`,
            ),
        );
}

/**
 * Report indexed files that their scope's selected configurations declare untracked.
 * @param input the check input with the shared index and resolved selections.
 * @returns one finding per matching indexed path.
 */
export function trackedFiles(input: CheckInput): Finding[] {
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
            findingAt(
                input,
                { file: path, line: 1 },
                'tracked-file',
                `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
            ),
        );
}
