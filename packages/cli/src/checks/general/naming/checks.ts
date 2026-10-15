import { findingAt } from '#cli/checks/finding.ts';
import { isCovered } from '#cli/repository/select.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { scopeOf, isInScope } from '#cli/repository/scopes.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { namingDefaults } from '#cli/configurations/manifests.ts';
import { nameFindings } from '#cli/checks/general/naming/names.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';
import { readNamingSettings } from '#cli/checks/general/naming/settings.ts';
import { pathMatcher, filenameMatcher } from '#cli/repository/selectors.ts';
import type { FileNames, Identifier, NamingSource, NamingSettings } from '#cli/types/checks/general.ts';
import { identifiersOf, fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/identifiers.ts';

function sourceFiles(input: CheckInput): NamingSource[] {
    const languages = input.selection.selected
        .filter((manifest) => manifest.configuration.group === 'language')
        .map((manifest) => ({
            manifest,
            filenames: filenameMatcher(manifest.files.filenames),
            paths: pathMatcher(manifest.files.paths),
        }));
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find(({ manifest, filenames, paths }) =>
                isCovered(manifest.files, file, filenames, paths),
            )?.manifest.configuration.name,
        }))
        .filter((entry): entry is NamingSource => entry.language !== undefined);
}

function findingsFor(input: CheckInput, settings: NamingSettings, identifiers: Identifier[]): Finding[] {
    const isTestFile = pathMatcher(input.selection.view.test_files);
    return identifiers.flatMap((identifier) =>
        nameFindings(identifier, {
            check: input.check,
            settings,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

function pathIdentifiers(input: CheckInput): Identifier[] {
    const containers = namingDefaults(input.reads).path_containers;
    const seen = new Set<string>();
    return sourceFiles(input).flatMap(({ file, language }) => {
        const all = [
            fileIdentifier(file.path, language, containers),
            ...directoryIdentifiers(file.path, language, containers),
        ];
        return all.filter((identifier) => {
            const key = JSON.stringify([identifier.directory ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

/**
 * Read lexical declarations and path names using each source file's selected language.
 * @param input the repository for this scope and syntax tree resources.
 * @returns declared names and the existing path-name projection for every readable source.
 */
async function declaredNames(input: CheckInput): Promise<FileNames[]> {
    const files: FileNames[] = [];
    for (const selection of input.selections) {
        const scopeInput = {
            ...input,
            selection,
            files: input.files.filter((file) => scopeOf(file.path, input.scopeEntries).path === selection.scope.path),
        };
        const paths = pathIdentifiers(scopeInput);
        for (const { file, language } of sourceFiles(scopeInput)) {
            const identifiers = await identifiersOf(
                file.path,
                readSource(input.root, file.path, input.reads).toString('utf8'),
                language,
                scopeInput,
            );
            const declarations = identifiers.map((identifier) => identifier.name);
            files.push({
                path: file.path,
                declarations,
                names: [
                    ...paths
                        .filter(
                            (identifier) =>
                                identifier.language === language &&
                                (identifier.directory === undefined
                                    ? identifier.file === file.path
                                    : isInScope(file.path, identifier.directory)),
                        )
                        .map((identifier) => identifier.name),
                    ...declarations,
                ],
            });
        }
    }
    return files;
}

/**
 * Reports allowed names in root naming overrides that match no code or path name.
 * @param input the selected check and repository files.
 * @returns findings for allowed names without matching declarations.
 */
export async function namingSettings(input: CheckInput): Promise<Finding[]> {
    const files = await declaredNames({ ...input, files: input.repositoryFiles });
    const directories = input.selections
        .flatMap((selection) =>
            pathIdentifiers({
                ...input,
                selection,
                files: input.repositoryFiles.filter(
                    (file) => scopeOf(file.path, input.scopeEntries).path === selection.scope.path,
                ),
            }),
        )
        .filter((identifier) => identifier.category === 'directories');
    return input.settingsFile.settings.naming.override.flatMap((override, index) => {
        const matches = pathMatcher(override.paths);
        const declared = new Set(
            files
                .filter((file) => matches(file.path))
                .flatMap((file) => {
                    if (override.categories === undefined) return file.names;
                    if (override.categories.includes('files')) return [...file.declarations, file.names[0]];
                    return file.declarations;
                }),
        );
        if (override.categories === undefined || override.categories.includes('directories')) {
            for (const identifier of directories.filter((identifier) =>
                matches(identifier.directory ?? identifier.file),
            ))
                declared.add(identifier.name);
        }
        return (override.allowed_names ?? [])
            .filter((name) => !declared.has(name))
            .map((name) =>
                findingAt(
                    input,
                    { file: SETTINGS_FILE },
                    'unused-entry',
                    `[[naming.override]] entry ${String(index + 1)} allowed_names includes "${name}", which no identifier under its paths uses.`,
                ),
            );
    });
}

/**
 * Check the names declared by source files in each selected scope.
 * @param input the selected check and repository files.
 * @returns the findings for declared source names.
 */
export async function namingIdentifiers(input: CheckInput): Promise<Finding[]> {
    const settings = readNamingSettings(input);
    const findings: Finding[] = [];
    for (const { file, language } of sourceFiles(input)) {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const identifiers = await identifiersOf(file.path, text, language, input);
        findings.push(...findingsFor(input, settings, identifiers));
    }
    return findings;
}

/**
 * Check file and directory names against their naming settings.
 * @param input the selected check and repository files.
 * @returns the findings for file and directory names.
 */
export function namingPaths(input: CheckInput): Finding[] {
    const settings = readNamingSettings(input);
    return findingsFor(input, settings, pathIdentifiers(input));
}
