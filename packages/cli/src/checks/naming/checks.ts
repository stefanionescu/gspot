import { buildFinding } from '#cli/runs/finding.ts';
import { findScope } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { checkIdentifier } from '#cli/checks/naming/names.ts';
import { buildFileMatcher } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { readNamingSettings } from '#cli/checks/naming/settings.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import { readNamingDefaults } from '#cli/configurations/manifests.ts';
import type { FileNames, NamedFile, Identifier, NamingSettings } from '#cli/types/checks/naming.ts';
import { parseIdentifiers, buildFileIdentifier, buildFolderIdentifiers } from '#cli/checks/naming/identifiers.ts';

function listNamedFiles(planned: PlannedCheck): NamedFile[] {
    const languages = planned.selection.selected
        .filter((manifest) => manifest.configuration.group === 'language')
        .map((manifest) => ({
            manifest,
            matches: buildFileMatcher(manifest.files),
        }));
    return planned.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find(({ matches }) => matches(file))?.manifest.configuration.name,
        }))
        .filter((entry): entry is NamedFile => entry.language !== undefined);
}

function checkIdentifiers(planned: PlannedCheck, settings: NamingSettings, identifiers: Identifier[]): Finding[] {
    const isTestFile = buildPathMatcher(planned.selection.view.test_files);
    return identifiers.flatMap((identifier) =>
        checkIdentifier(identifier, {
            check: planned.check,
            settings,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

function listPathIdentifiers(planned: PlannedCheck): Identifier[] {
    const containers = readNamingDefaults().path_containers;
    const seen = new Set<string>();
    return listNamedFiles(planned).flatMap(({ file, language }) => {
        const all = [
            buildFileIdentifier(file.path, language, containers),
            ...buildFolderIdentifiers(file.path, language, containers),
        ];
        return all.filter((identifier) => {
            const key = JSON.stringify([identifier.folder ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

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
    for (const selection of session.scopes) {
        const scopeInput = {
            ...planned,
            selection,
            files: planned.files.filter(
                (file) => findScope(file.path, session.repository.scopes).path === selection.scope.path,
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

/**
 * Checks the names that source files declare.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to read.
 * @returns the findings.
 */
export async function checkNamingIdentifiers(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const settings = readNamingSettings(session.settingsFile.settings, planned.selection);
    const findings: Finding[] = [];
    for (const { file, language } of listNamedFiles(planned)) {
        const text = readCachedText(session.reads, file.path);
        const { identifiers, error } = await parseIdentifiers(file.path, text, language, session);
        // The language's own linter reports a file that does not parse.
        if (error !== undefined) continue;
        findings.push(...checkIdentifiers(planned, settings, identifiers));
    }
    return findings;
}

/**
 * Checks file and folder names against the naming settings.
 *
 * @param session the repository and its tools.
 * @param planned the scope files to check.
 * @returns the findings.
 */
export function checkNamingPaths(session: Session, planned: PlannedCheck): Finding[] {
    const settings = readNamingSettings(session.settingsFile.settings, planned.selection);
    return checkIdentifiers(planned, settings, listPathIdentifiers(planned));
}
