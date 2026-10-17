import { buildFinding } from '#cli/checks/finding.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { buildFileMatcher } from '#cli/repository/coverage.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { findScope, isInScope } from '#cli/repository/scopes.ts';
import { checkIdentifier } from '#cli/checks/general/naming/names.ts';
import { readNamingDefaults } from '#cli/configurations/manifests.ts';
import type { Finding, CheckInput } from '#cli/types/checks/run/check.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import type { FileNames, NamedFile, Identifier, NamingSettings } from '#cli/types/checks/general.ts';

import {
    parseIdentifiers,
    buildFileIdentifier,
    buildFolderIdentifiers,
} from '#cli/checks/general/naming/identifiers.ts';

function listNamedFiles(input: CheckInput): NamedFile[] {
    const languages = input.selection.selected
        .filter((manifest) => manifest.configuration.group === 'language')
        .map((manifest) => ({
            manifest,
            matches: buildFileMatcher(manifest.files),
        }));
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find(({ matches }) => matches(file))?.manifest.configuration.name,
        }))
        .filter((entry): entry is NamedFile => entry.language !== undefined);
}

function checkIdentifiers(input: CheckInput, settings: NamingSettings, identifiers: Identifier[]): Finding[] {
    const isTestFile = buildPathMatcher(input.selection.view.test_files);
    return identifiers.flatMap((identifier) =>
        checkIdentifier(identifier, {
            check: input.check,
            settings,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

function listPathIdentifiers(input: CheckInput): Identifier[] {
    const containers = readNamingDefaults(input.reads).path_containers;
    const seen = new Set<string>();
    return listNamedFiles(input).flatMap(({ file, language }) => {
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
 * @param input the files and scopes to read.
 * @returns the names of each file, and syntax findings.
 */
async function readDeclaredNames(input: CheckInput): Promise<{ files: FileNames[]; findings: Finding[] }> {
    const files: FileNames[] = [];
    const findings: Finding[] = [];
    for (const selection of input.selections) {
        const scopeInput = {
            ...input,
            selection,
            files: input.files.filter((file) => findScope(file.path, input.scopes).path === selection.scope.path),
        };
        const paths = listPathIdentifiers(scopeInput);
        for (const { file, language } of listNamedFiles(scopeInput)) {
            const { identifiers, error } = await parseIdentifiers(
                file.path,
                readCachedBytes(input.reads, file.path).toString('utf8'),
                language,
                scopeInput,
            );
            // The language's own linter reports a file that does not parse.
            if (error !== undefined) continue;
            const declarations = identifiers.map((identifier) => identifier.name);
            files.push({
                path: file.path,
                declarations,
                names: [
                    ...paths
                        .filter(
                            (identifier) =>
                                identifier.language === language &&
                                (identifier.folder === undefined
                                    ? identifier.file === file.path
                                    : isInScope(file.path, identifier.folder)),
                        )
                        .map((identifier) => identifier.name),
                    ...declarations,
                ],
            });
        }
    }
    return { files, findings };
}

/**
 * Reports allowed names in root naming overrides that match no code or path name.
 * @param input the settings and tracked files.
 * @returns the findings.
 */
export async function checkNamingAllowedNames(input: CheckInput): Promise<Finding[]> {
    const { files, findings } = await readDeclaredNames({ ...input, files: input.repositoryFiles });
    if (findings.length > 0) return findings;
    const folders = input.selections
        .flatMap((selection) =>
            listPathIdentifiers({
                ...input,
                selection: selection,
                files: input.repositoryFiles.filter(
                    (file) => findScope(file.path, input.scopes).path === selection.scope.path,
                ),
            }),
        )
        .filter((identifier) => identifier.category === 'folders');
    return input.settingsFile.settings.naming.override.flatMap((override, index) => {
        const matches = buildPathMatcher(override.paths);
        const declared = new Set(
            files
                .filter((file) => matches(file.path))
                .flatMap((file) => {
                    if (override.categories === undefined) return file.names;
                    if (override.categories.includes('files')) return [...file.declarations, file.names[0]];
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
                    input,
                    { file: SETTINGS_FILE },
                    'unused-record',
                    `[[naming.override]] record ${String(index + 1)} allowed_names includes "${name}", which no identifier under its paths uses.`,
                ),
            );
    });
}

/**
 * Checks the names that source files declare.
 * @param input the scope files to read.
 * @returns the findings.
 */
export async function checkNamingIdentifiers(input: CheckInput): Promise<Finding[]> {
    const settings = readNamingSettings(input);
    const findings: Finding[] = [];
    for (const { file, language } of listNamedFiles(input)) {
        const text = readCachedBytes(input.reads, file.path).toString('utf8');
        const { identifiers, error } = await parseIdentifiers(file.path, text, language, input);
        // The language's own linter reports a file that does not parse.
        if (error !== undefined) continue;
        findings.push(...checkIdentifiers(input, settings, identifiers));
    }
    return findings;
}

/**
 * Checks file and folder names against the naming settings.
 * @param input the scope files to check.
 * @returns the findings.
 */
export function checkNamingPaths(input: CheckInput): Finding[] {
    const settings = readNamingSettings(input);
    return checkIdentifiers(input, settings, listPathIdentifiers(input));
}
