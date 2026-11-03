import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import { UNUSED_RECORD_RULE } from '#cli/config/configurations/naming.ts';
import type { FileNames, NamedCategory, NamingOverride } from '#cli/types/configurations/general.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/configurations/general/naming/checks/source-names.ts';
import { buildFileIdentifier, buildFolderIdentifiers } from '#cli/configurations/general/naming/checks/paths.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three name lists share this one reading of an override without categories.
function isCategoryCovered(override: Pick<NamingOverride, 'categories'>, category: NamedCategory): boolean {
    return override.categories === undefined || override.categories.includes(category);
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

function listOverrideNames(
    override: Session['settings']['naming']['exception'][number],
    files: FileNames[],
    folders: FileNames['folders'],
): Set<string> {
    const isMatched = buildPathMatcher(override.paths);
    const sourceNames = new Set(
        files
            .filter((file) => isMatched(file.path))
            .flatMap((file) => {
                const declarations = file.declarations
                    .filter((identifier) => isCategoryCovered(override, identifier.category))
                    .map((identifier) => identifier.name);
                return isCategoryCovered(override, 'files') ? [file.stem, ...declarations] : declarations;
            }),
    );
    if (isCategoryCovered(override, 'folders'))
        for (const identifier of folders)
            if (isMatched(identifier.folder ?? identifier.file)) sourceNames.add(identifier.name);
    return sourceNames;
}

/**
Reports allowed names in root naming exceptions that match no code or path name. Only the files that an override with
allowed names covers, by their path or a folder above them, get parsed.

@param session the repository and its tools.
@param planned the settings and tracked files.
*/
export async function checkAllowedNames(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const matchers = session.settings.naming.exception
        .filter((override) => (override.allowed_names ?? []).length > 0)
        .map((override) => buildPathMatcher(override.paths));
    const covered = session.repository.files.filter((file) => {
        const segments = file.path.split('/');
        return segments.some((_, index) => {
            const path = segments.slice(0, index + 1).join('/');
            return matchers.some((isMatched) => isMatched(path));
        });
    });
    const files = await readSourceNames(session, { ...planned, files: covered });
    const folders = files.flatMap((file) => file.folders).filter((identifier) => identifier.category === 'folders');
    return session.settings.naming.exception.flatMap((override, index) => {
        const sourceNames = listOverrideNames(override, files, folders);
        return (override.allowed_names ?? [])
            .filter((name) => !sourceNames.has(name))
            .map((name) => ({
                file: SETTINGS_FILE,
                rule: UNUSED_RECORD_RULE,
                message: `[[naming.exception]] record ${String(index + 1)} allowed_names includes "${name}", which no identifier under its paths uses.`,
            }));
    });
}
