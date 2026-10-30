import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { find } from '#cli/system/files/reads.ts';
import { GspotError } from '#cli/system/errors.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { PBXPROJ_SUFFIX } from '#cli/config/files/names.ts';
import { selectScopePath } from '#cli/repository/scopes.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildFilenameMatcher } from '#cli/system/matchers.ts';
import { isTable, stripUndefined } from '#cli/system/tables.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { readScopeFormat } from '#cli/commands/init/formatter-settings.ts';
import { buildImportExtensionTables } from '#cli/commands/init/import-extension.ts';
import { SWIFT_CONFIGURATION, OPENAPI_CONFIGURATION } from '#cli/config/configurations/names.ts';
import { PREFACE_BODY, LEADING_COMMENTS, XCODE_DESTINATIONS } from '#cli/config/commands/init/settings-text.ts';
import type { InitOptions, SettingsDraft, InitConfigurations, ScopeConfigurations } from '#cli/types/commands/init.ts';

function buildOpenApiTables(
    scopes: ScopeConfigurations[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    return new Map(
        scopes.flatMap(({ scope, selected }) => {
            const openapi = selected.find((configuration) => configuration.name === OPENAPI_CONFIGURATION);
            if (openapi === undefined) return [];
            const isDocument = buildFilenameMatcher(openapi.detect.filenames);
            const document = repository.files.find(
                (file) => selectScopePath(file.path, draft.scopes) === scope && isDocument(file.path),
            )?.path;
            return document === undefined ? [] : [[scope, { openapi: { document } }] as const];
        }),
    );
}

function buildSwiftTables(
    scopes: ScopeConfigurations[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const projectFiles = repository.files.filter((each) => each.path.endsWith(PBXPROJ_SUFFIX));
    return new Map(
        scopes.flatMap(({ scope, selected }) => {
            if (selected.every((configuration) => configuration.name !== SWIFT_CONFIGURATION)) return [];
            const file = projectFiles.find(
                (projectFile) => selectScopePath(projectFile.path, draft.scopes) === scope,
            )?.path;
            if (file === undefined) return [];
            const text = find(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text, file).sdkRoot;
            const destination = XCODE_DESTINATIONS.get(sdkRoot);
            const swiftSettings = {
                xcode_project: posix.dirname(file),
                ...stripUndefined({ xcode_destination: destination }),
            };
            return [[scope, { swift: swiftSettings }] as const];
        }),
    );
}

function overlayTable(target: TomlTable, source: TomlTable): TomlTable {
    for (const [key, value] of Object.entries(source))
        target[key] = isTable(value) && isTable(target[key]) ? overlayTable(target[key], value) : value;
    return target;
}

function buildSettingsTable(
    draft: SettingsDraft,
    repository: Repository,
    configurationsByName: Map<string, Configuration>,
): TomlTable {
    const selected = {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: new Map(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const scopes = ['', ...draft.scopes.map((each) => each.path)];
    const scopeConfigurations = scopes.map((scopePath) => ({
        scope: scopePath,
        selected: selectForScope(selected, scopePath, configurationsByName),
    }));
    const projects = buildSwiftTables(scopeConfigurations, draft, repository);
    const formats = new Map(
        scopeConfigurations.map((selection) => [selection.scope, readScopeFormat(selection, draft, repository)]),
    );
    const openapiTables = buildOpenApiTables(scopeConfigurations, draft, repository);
    const importStyles = buildImportExtensionTables(scopeConfigurations, repository);
    const tables = new Map(
        scopes.map((scopePath) => [
            scopePath,
            {
                ...projects.get(scopePath),
                ...openapiTables.get(scopePath),
                ...formats.get(scopePath),
                ...importStyles.get(scopePath),
            },
        ]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return overlayTable(draft.template === undefined ? {} : structuredClone(draft.template.table), {
        ...(draft.level !== undefined && { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...stripUndefined({ scope: scope.length === 0 ? undefined : scope }),
    });
}

/**
Build the gspot.toml text for a settings draft.

@param draft the settings choices.
@param repository the tracked source files.
@param configurationsByName the configurations to choose from.
@returns the TOML text, with the preface and the comments of the copied keys.
*/
export function buildInitSettings(
    draft: SettingsDraft,
    repository: Repository,
    configurationsByName: Map<string, Configuration>,
): string {
    const document = buildSettingsTable(draft, repository, configurationsByName);
    setKey(document, 'hooks.enabled', true);
    setKey(document, 'rules.enabled', true);
    delete document['ci'];
    const checked = settingsSchema.safeParse(document);
    if (draft.template !== undefined && !checked.success) {
        const errors = checked.error.issues
            .map((issue) => '  ' + issue.path.join('.') + ': ' + issue.message)
            .join('\n');
        throw new GspotError(
            'settings',
            `The settings copied from ${draft.template.file} do not fit this repository. Edit a copy of the file, then run gspot init again:\n${errors}`,
        );
    }
    return buildSettingsText(PREFACE_BODY, draft.base, stripDefaults(document));
}

/**
Draft the settings from the configuration choices.

@param configurations the configurations and scopes.
@param options the authored level, when selected.
*/
export function buildSettingsDraft(
    configurations: InitConfigurations,
    options: Pick<InitOptions, 'level' | 'template'>,
): SettingsDraft {
    const scopes = configurations.scopes.filter((scope) => scope.path !== '');
    return {
        base: options.template?.text.replace(LEADING_COMMENTS, '') ?? '',
        configurations: configurations.rootNames,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: configurations.scopeConfigurations.get(scope.path) ?? [],
        })),
        ...stripUndefined({ level: options.level, template: options.template }),
    };
}
