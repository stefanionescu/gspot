import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { SETTINGS_FILE } from '#cli/config/gspot-paths.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import type { FileNames } from '#cli/types/checks/naming.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { listNamedFiles, parseIdentifiers } from '#cli/checks/naming/declared-names.ts';
import { buildFileIdentifier, buildFolderIdentifiers } from '#cli/checks/naming/paths.ts';

/**
 * Reads the declared names and path names of each source file, by its language.
 *
 * @param session the repository and its tools.
 * @param planned the files and scopes to read.
 * @returns the names of each file.
 */
async function readDeclaredNames(session: Session, planned: PlannedCheck): Promise<FileNames[]> {
    const files: FileNames[] = [];
    const containers = readNamingDefaults().path_containers;
    for (const scope of session.scopes) {
        const scopeInput = {
            ...planned,
            scope,
            files: planned.files.filter(
                (file) => findScopeFolder(file.path, session.repository.scopeFolders).path === scope.folder.path,
            ),
        };
        const named = listNamedFiles(scopeInput);
        for (const { file, language } of named) {
            const stem = buildFileIdentifier(file.path, language, containers);
            const folders = buildFolderIdentifiers(file.path, language, containers);
            const { identifiers, error } = await parseIdentifiers(
                file.path,
                readCachedText(session.reads, file.path),
                language,
                session,
            );
            // A syntax failure leaves folder allowances usable while the language linter owns its declarations.
            if (error !== undefined) {
                files.push({ path: file.path, stem: stem.name, declarations: undefined, folders, names: [] });
                continue;
            }
            const declarations = identifiers.map((identifier) => identifier.name);
            files.push({
                path: file.path,
                stem: stem.name,
                declarations,
                folders,
                names: [stem.name, ...folders.map((identifier) => identifier.name), ...declarations],
            });
        }
    }
    return files;
}

/**
 * Reports allowed names in root naming overrides that match no code or path name.
 *
 * @param session the repository and its tools.
 * @param planned the settings and tracked files.
 * @returns the findings.
 */
export async function checkNamingAllowedNames(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const files = await readDeclaredNames(session, { ...planned, files: session.repository.files });
    const folders = files.flatMap((file) => file.folders).filter((identifier) => identifier.category === 'folders');
    return session.settingsFile.settings.naming.override.flatMap((override, index) => {
        const matches = buildPathMatcher(override.paths);
        const declared = new Set(
            files
                .filter((file) => matches(file.path))
                .flatMap((file) => {
                    if (file.declarations === undefined) return [];
                    if (override.categories === undefined) return file.names;
                    if (override.categories.includes('files')) return [...file.declarations, file.stem];
                    return file.declarations;
                }),
        );
        if (override.categories === undefined || override.categories.includes('folders')) {
            for (const identifier of folders.filter((identifier) => matches(identifier.folder ?? identifier.file)))
                declared.add(identifier.name);
        }
        return (override.allowed_names ?? [])
            .filter((name) => !declared.has(name))
            .map((name) =>
                buildFinding(
                    planned,
                    { file: SETTINGS_FILE },
                    'unused-record',
                    `[[naming.override]] record ${String(index + 1)} allowed_names includes "${name}", which no identifier under its paths uses.`,
                ),
            );
    });
}
