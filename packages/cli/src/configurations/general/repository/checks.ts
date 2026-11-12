import { isUtf8 } from 'node:buffer';
import { lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';

import { ABSOLUTE_LINK_HELP, OUTWARD_LINK_HELP, REPOSITORY_RULES } from '#cli/config/configurations/structure.ts';
import { BYTES_PER_KILOBYTE } from '#cli/config/engine.ts';
import { FILTER_ATTRIBUTE, LFS_FILTER, SYMLINK_MODE } from '#cli/config/repository/files.ts';
import { ENCODING_EXPLANATIONS, LOCAL_FILE_EXPLANATIONS } from '#cli/configurations/general/repository/explanations.ts';
import { getMaxFileBytes } from '#cli/engine/files.ts';
import { selectScope, selectScopePath } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { readBytes } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { extractParentFolder, isInside } from '#cli/system/paths.ts';
import { listConflictMarkerLines } from '#cli/system/text.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

function listLinkFindings(root: string, path: string): CheckFinding[] {
    const source = join(root, path);
    if (lstatSync(source, { throwIfNoEntry: false })?.isSymbolicLink() !== true) return [];
    const link = readlinkSync(source);
    if (isAbsolute(link))
        return [
            {
                file: path,
                line: 1,
                rule: REPOSITORY_RULES.absoluteLink,
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
    return isInside(relative(root, target))
        ? []
        : [
              {
                  file: path,
                  line: 1,
                  rule: REPOSITORY_RULES.outwardLink,
                  message: `${path} links outside the repository.`,
                  help: OUTWARD_LINK_HELP,
              },
          ];
}

function listInvalidLinks(session: Session, narrowedLinks: string[] | undefined): CheckFinding[] {
    return session.repository.index
        .filter((file) => file.mode === SYMLINK_MODE && (narrowedLinks?.includes(file.path) ?? true))
        .flatMap(({ path }) => listLinkFindings(session.root, path));
}

function checkLargeFiles(session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files.flatMap((file) => {
        const scope = selectScope(file.path, session.scopes);
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
                rule: REPOSITORY_RULES.size,
                message: `${String(Math.round(file.size / BYTES_PER_KILOBYTE))} kB is over the ${String(limitKilobytes)} kB limit; mark it as generated or vendored in .gitattributes, move it to LFS, or ignore this finding with a reason.`,
            },
        ];
    });
}

/**
Reports indexed files that the scope configurations mark as untracked, and the links that leave the repository. A
commit or a push reports only its staged or pushed links.
*/
function checkLocalFiles(session: CheckSession, planned: PlannedCheck): CheckFinding[] {
    const scopes = session.repository.scopeFolders;
    const matchers = new Map(
        session.scopes.map(({ path: scopePath, configurations, settings }): [string, (path: string) => boolean] => {
            const isIgnored = buildPathMatcher(configurations.flatMap((configuration) => configuration.ignored_paths));
            const examples = new Set(getTable(settings, 'secrets').environment_examples);
            return [
                scopePath,
                (path) => {
                    const parent = extractParentFolder(path);
                    return (
                        isIgnored(path) &&
                        (!examples.has(posix.basename(path)) || isIgnored(parent === '' ? parent : `${parent}/`))
                    );
                },
            ];
        }),
    );
    const narrowed = session.selection?.paths;
    const tracked = [...new Set(session.repository.index.map(({ path }) => path))]
        .filter((path) => {
            if (narrowed?.includes(path) === false) return false;
            const scopePath = selectScopePath(path, scopes);
            return matchers.get(scopePath)?.(posix.relative(scopePath, path)) === true;
        })
        .map((path) => ({
            file: path,
            line: 1,
            rule: REPOSITORY_RULES.trackedFile,
            message: `${path} is tracked; its selected configuration declares it untracked. Remove it from the Git index and add it to .gitignore.`,
        }));
    const links = listInvalidLinks(session, planned.narrowedLinks);
    return [...tracked, ...links];
}

function checkEncoding(session: Session, planned: PlannedCheck): CheckFinding[] {
    const unreadable = session.repository.unreadablePaths.map((path) => ({
        file: path,
        line: 1,
        rule: REPOSITORY_RULES.pathEncoding,
        message: `${path} is not a UTF-8 path. Rename the file using UTF-8.`,
    }));
    return [
        ...unreadable,
        ...planned.files
            .filter(
                (file) =>
                    file.tags.includes('text') &&
                    !file.tags.includes('symlink') &&
                    file.size <= getMaxFileBytes(session.scopes, file.path) &&
                    !isUtf8(readBytes(session.cache, file.path)),
            )
            .map((file) => ({
                file: file.path,
                line: 1,
                rule: REPOSITORY_RULES.encoding,
                message: `${file.path} is not UTF-8 text. Save it as UTF-8, then run the command again.`,
            })),
    ];
}

function checkConflictMarkers(session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files
        .filter((file) => file.tags.includes('text') && !file.tags.includes('symlink'))
        .flatMap((file) =>
            listConflictMarkerLines(readBytes(session.cache, file.path).toString('utf8')).map((line) => ({
                file: file.path,
                line,
                rule: REPOSITORY_RULES.conflictMarker,
                message: 'This line is a merge-conflict marker. Resolve the conflict.',
            })),
        );
}

export const REPOSITORY_CHECKS: Readonly<Record<string, CheckCode>> = {
    'repository/conflict-markers': { check: checkConflictMarkers },
    'repository/encoding': { check: checkEncoding, explanations: ENCODING_EXPLANATIONS },
    'repository/large-files': { check: checkLargeFiles },
    'repository/local-files': { check: checkLocalFiles, explanations: LOCAL_FILE_EXPLANATIONS },
};
