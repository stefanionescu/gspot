import { isUtf8 } from 'node:buffer';
import { getTable } from '#cli/settings/scopes.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import type { Session } from '#cli/types/session.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { SYMLINK_MODE } from '#cli/config/files/modes.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/units.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { lstatSync, realpathSync, readlinkSync } from 'node:fs';
import { isInside, extractParentFolder } from '#cli/system/paths.ts';
import { join, posix, dirname, resolve, relative, isAbsolute } from 'node:path';
import { LFS_FILTER, FILTER_ATTRIBUTE } from '#cli/config/repository/files/classify.ts';
import { RULES, OUTWARD_LINK_HELP, ABSOLUTE_LINK_HELP } from '#cli/config/checks/general/repository.ts';

/**
Reports each tracked file over `repository.max_file_kilobytes`, except generated, vendored, and Git Large File Storage (LFS) files.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkRepositoryLargeFiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files.flatMap((file) => {
        const scopePath = selectScopePath(file.path, session.scopes);
        const scope = session.scopes.find((scope) => scope.path === scopePath) as Scope;
        const limitKilobytes = getTable(scope.settings, 'repository').max_file_kilobytes;
        if (
            file.kind === 'generated' ||
            file.kind === 'vendored' ||
            file.size <= limitKilobytes * BYTES_PER_KILOBYTE ||
            session.repository.attributes.get(file.path)?.[FILTER_ATTRIBUTE] === LFS_FILTER
        )
            return [];
        return [
            {
                file: file.path,
                line: 1,
                rule: RULES.size,
                message: `${String(Math.round(file.size / BYTES_PER_KILOBYTE))} kB is over the ${String(limitKilobytes)} kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.`,
            },
        ];
    });
}

function listInvalidLinks(session: Session): CheckFinding[] {
    return session.repository.index
        .filter((file) => file.mode === SYMLINK_MODE)
        .flatMap(({ path }): CheckFinding[] => {
            const source = join(session.root, path);
            if (lstatSync(source, { throwIfNoEntry: false })?.isSymbolicLink() !== true) return [];
            const link = readlinkSync(source);
            if (isAbsolute(link))
                return [
                    {
                        file: path,
                        line: 1,
                        rule: RULES.absoluteLink,
                        message: `${path} uses an absolute link target.`,

                        help: ABSOLUTE_LINK_HELP,
                    },
                ];
            let target = resolve(dirname(source), link);
            try {
                target = realpathSync(target);
            } catch (error) {
                if (!hasErrorCode(error, 'ENOENT') && !hasErrorCode(error, 'ELOOP')) throw error;
            }
            return isInside(relative(session.root, target))
                ? []
                : [
                      {
                          file: path,
                          line: 1,
                          rule: RULES.outwardLink,
                          message: `${path} links outside the repository.`,

                          help: OUTWARD_LINK_HELP,
                      },
                  ];
        });
}

/**
Reports indexed files that the scope configurations mark as untracked.

@param session the repository and its tools.
@param _planned the configured check and selected scope files.
*/
export function checkRepositoryLocalFiles(session: Session, _planned: PlannedCheck): CheckFinding[] {
    const scopes = session.repository.scopeFolders;
    const matchers = new Map(
        session.scopes.map(({ path: scopePath, configurations, settings }): [string, (path: string) => boolean] => {
            const matches = buildPathMatcher(configurations.flatMap((configuration) => configuration.ignored_paths));
            const examples = new Set(getTable(settings, 'secrets').env_examples);
            return [
                scopePath,
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
            const scope = selectScopePath(path, scopes);
            return matchers.get(scope)?.(posix.relative(scope, path)) === true;
        })
        .map((path) => ({
            file: path,
            line: 1,
            rule: RULES.trackedFile,
            message: `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
        }));
    const links = listInvalidLinks(session);
    return [...tracked, ...links];
}

/**
Report tracked text files that need UTF-8 encoding.

@param session the repository file cache.
@param planned the configured check and selected scope files.
*/
export function checkRepositoryEncoding(session: Session, planned: PlannedCheck): CheckFinding[] {
    const unreadable = session.repository.unreadablePaths.map((path) => ({
        file: path,
        line: 1,
        rule: RULES.pathEncoding,
        message: `${path} is not a UTF-8 path. Rename the file using UTF-8.`,
    }));
    return [
        ...unreadable,
        ...planned.files
            .filter(
                (file) =>
                    file.tags.includes('text') &&
                    !file.tags.includes('symlink') &&
                    !isUtf8(readBytes(session.reads, file.path)),
            )
            .map((file) => ({
                file: file.path,
                line: 1,
                rule: RULES.encoding,
                message: `${file.path} is not UTF-8 text. Save it as UTF-8, then run the command again.`,
            })),
    ];
}
