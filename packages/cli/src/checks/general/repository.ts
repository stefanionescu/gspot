import { isUtf8 } from 'node:buffer';
import { getTable } from '#cli/settings/scopes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { SYMLINK_MODE } from '#cli/config/files/modes.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { lstatSync, realpathSync, readlinkSync } from 'node:fs';
import { join, posix, dirname, resolve, relative } from 'node:path';
import { isInside, extractParentFolder } from '#cli/system/paths.ts';
import { LFS_FILTER } from '#cli/config/repository/files/classify.ts';

/**
Reports each tracked file over `repository.max_file_kilobytes`, except generated, vendored, and Git Large File Storage (LFS) files.

@param session the repository and its tools.
@param planned the tracked files and size limit.
@returns the findings.
*/
export function checkRepositoryLargeFiles(session: Session, planned: PlannedCheck): Finding[] {
    const limitKilobytes = getTable(planned.scope.settings, 'repository').max_file_kilobytes;
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
Reports indexed files that the scope configurations mark as untracked.

@param session the repository and its tools.
@param planned the Git index and each scope.
@returns the findings.
*/
export function checkRepositoryLocalFiles(session: Session, planned: PlannedCheck): Finding[] {
    const scopes = session.scopes.map(({ folder }) => folder);
    const matchers = new Map(
        session.scopes.map(({ folder, configurations, settings }): [string, (path: string) => boolean] => {
            const matches = buildPathMatcher(configurations.flatMap((configuration) => configuration.ignored_paths));
            const examples = new Set(getTable(settings, 'secrets').env_examples);
            return [
                folder.path,
                (path) => {
                    const parent = extractParentFolder(path);
                    return (
                        matches(path) &&
                        (!examples.has(posix.basename(path)) || matches(parent === '' ? parent : `${parent}/`))
                    );
                },
            ];
        }),
    );
    const tracked = [...new Set(session.repository.index.map(({ path }) => path))]
        .filter((path) => {
            const scope = findScopeFolder(path, scopes).path;
            return matchers.get(scope)?.(posix.relative(scope, path)) === true;
        })
        .map((path) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'tracked-file',
                `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
            ),
        );
    const links = session.repository.index
        .filter((file) => file.mode === SYMLINK_MODE)
        .filter(({ path }) => {
            const source = join(session.root, path);
            if (lstatSync(source, { throwIfNoEntry: false }) === undefined) return false;
            let target = resolve(dirname(source), readlinkSync(source));
            try {
                target = realpathSync(target);
            } catch (error) {
                if (!hasErrorCode(error, 'ENOENT') && !hasErrorCode(error, 'ELOOP')) throw error;
            }
            return !isInside(relative(session.root, target));
        })
        .map(({ path }) =>
            buildFinding(
                planned,
                { file: path, line: 1 },
                'outward-link',
                `${path} links outside the repository. Replace the link with a file or folder in the repository.`,
            ),
        );
    return [...tracked, ...links];
}

/**
Report tracked text files that need UTF-8 encoding.

@param session the repository file cache.
@param planned the tracked text files.
@returns one finding for each invalid encoding.
*/
export function checkRepositoryEncoding(session: Session, planned: PlannedCheck): Finding[] {
    return planned.files
        .filter(
            (file) =>
                file.tags.includes('text') &&
                !file.tags.includes('symlink') &&
                !isUtf8(readCachedBytes(session.reads, file.path)),
        )
        .map((file) =>
            buildFinding(
                planned,
                { file: file.path, line: 1 },
                'encoding',
                `${file.path} is not UTF-8 text. Save it as UTF-8, then run the command again.`,
            ),
        );
}
