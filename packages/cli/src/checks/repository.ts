import { posix } from 'node:path';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { extractParentFolder } from '#cli/system/paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { LFS_FILTER } from '#cli/config/repository/inventory.ts';
import { findScope, joinScope } from '#cli/repository/scopes.ts';

/**
 * Reports each tracked file over `repository.max_file_kilobytes`, except generated, vendored, and Git Large File Storage (LFS) files.
 *
 * @param session the repository and its tools.
 * @param planned the tracked files and size limit.
 * @returns the findings.
 */
export function checkRepositoryLargeFiles(session: Session, planned: PlannedCheck): Finding[] {
    const limitKilobytes = getTable(planned.selection.view, 'repository').max_file_kilobytes;
    return session.repository.files
        .filter(
            (file) =>
                file.kind !== 'generated' &&
                file.kind !== 'vendored' &&
                file.size > limitKilobytes * BYTES_PER_KILOBYTE &&
                session.repository.attributes.get(file.path)?.['filter'] !== LFS_FILTER,
        )
        .map((file) =>
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'size',
                `${String(Math.round(file.size / BYTES_PER_KILOBYTE))} kB is over the ${String(limitKilobytes)} kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.`,
            ),
        );
}

/**
 * Reports indexed files that the scope configurations mark as untracked.
 *
 * @param session the repository and its tools.
 * @param planned the Git index and each scope.
 * @returns the findings.
 */
export function checkRepositoryLocalFiles(session: Session, planned: PlannedCheck): Finding[] {
    const scopes = session.scopes.map(({ scope }) => scope);
    const matchers = session.scopes.map(({ scope, selected, view }) => {
        const matches = buildPathMatcher(selected.flatMap((configuration) => configuration.ignored_paths));
        const examples = new Set(getTable(view, 'secrets').env_examples);
        return {
            scope,
            matches: (path: string) =>
                matches(path) &&
                (!examples.has(posix.basename(path)) || matches(joinScope(extractParentFolder(path), ''))),
        };
    });
    return [...new Set(session.repository.index.map(({ path }) => path))]
        .filter((path) =>
            matchers.some(
                ({ scope, matches }) =>
                    findScope(path, scopes).path === scope.path && matches(posix.relative(scope.path, path)),
            ),
        )
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'tracked-file',
                `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
            ),
        );
}
