import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { UNUSED_RECORD_RULE } from '#cli/config/configurations/naming.ts';
import type { FileNames, NamedCategory, NamingException } from '#cli/types/configurations/general.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/configurations/general/naming/checks/source-names.ts';
import { buildFileIdentifier, buildFolderIdentifiers } from '#cli/configurations/general/naming/checks/paths.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three name lists share this one reading of an exception without categories.
function isCategoryCovered(exception: Pick<NamingException, 'categories'>, category: NamedCategory): boolean {
    return exception.categories === undefined || exception.categories.includes(category);
}

async function readSourceNames(session: Session, planned: PlannedCheck): Promise<FileNames[]> {
    const files: FileNames[] = [];
    const containers = readNamingDefaults().path_containers;
    const filesByScope = Map.groupBy(planned.files, (file) =>
        selectScopePath(file.path, session.repository.scopeFolders),
    );
    for (const scope of session.scopes) {
        const named = listNamedFiles({ ...planned, scope, files: filesByScope.get(scope.path) ?? [] });
        for (const { file, language } of named) {
            const stem = buildFileIdentifier(file.path, language, containers);
            const folders = buildFolderIdentifiers(file.path, language, containers);
            const { identifiers, error } = await parseIdentifiers(
                file.path,
                readText(session.cache, file.path),
                language,
                session,
            );
            files.push({
                path: file.path,
                stem: stem.name,
                declarations: error === undefined ? identifiers : [],
                folders,
            });
        }
    }
    return files;
}

function listExceptionNames(
    exception: Session['settings']['naming']['exception'][number],
    files: FileNames[],
    folders: FileNames['folders'],
): Set<string> {
    const isMatched = buildPathMatcher(exception.paths);
    const sourceNames = new Set(
        files
            .filter((file) => isMatched(file.path))
            .flatMap((file) => {
                const declarations = file.declarations
                    .filter((identifier) => isCategoryCovered(exception, identifier.category))
                    .map((identifier) => identifier.name);
                return isCategoryCovered(exception, 'files') ? [file.stem, ...declarations] : declarations;
            }),
    );
    if (isCategoryCovered(exception, 'folders'))
        for (const identifier of folders)
            if (isMatched(identifier.folder ?? identifier.file)) sourceNames.add(identifier.name);
    return sourceNames;
}

/**
Reports allowed names in root naming exceptions that match no code or path name. Only the files that an exception with
allowed names covers, by their path or a folder above them, get parsed.

@param session the repository and its tools.
@param planned the settings and tracked files.
*/
async function checkAllowedNames(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const matchers = session.settings.naming.exception
        .filter((exception) => (exception.allowed_names ?? []).length > 0)
        .map((exception) => buildPathMatcher(exception.paths));
    const covered = session.repository.files.filter((file) => {
        const segments = file.path.split('/');
        return segments.some((_, index) => {
            const path = segments.slice(0, index + 1).join('/');
            return matchers.some((isMatched) => isMatched(path));
        });
    });
    const files = await readSourceNames(session, { ...planned, files: covered });
    const folders = files.flatMap((file) => file.folders).filter((identifier) => identifier.category === 'folders');
    return session.settings.naming.exception.flatMap((exception, index) => {
        const sourceNames = listExceptionNames(exception, files, folders);
        return (exception.allowed_names ?? [])
            .filter((name) => !sourceNames.has(name))
            .map((name) => ({
                file: SETTINGS_FILE,
                rule: UNUSED_RECORD_RULE,
                message: `[[naming.exception]] record ${String(index + 1)} allowed_names includes "${name}", which no identifier under its paths uses.`,
            }));
    });
}

export const NAMING_ALLOWED_NAMES_CHECKS: Readonly<Record<string, CheckCode>> = {
    'naming/allowed-names': { check: checkAllowedNames },
};
