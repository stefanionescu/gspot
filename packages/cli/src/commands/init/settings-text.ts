import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { PBXPROJ } from '#cli/config/files/names.ts';
import { findText } from '#cli/system/files/reads.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { findScopePath } from '#cli/repository/scopes.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildFilenameMatcher } from '#cli/system/matchers.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import type { Repository } from '#cli/types/repository/files.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { parseBuildSettings } from '#cli/parsers/projects/xcode.ts';
import { readScopeFormat } from '#cli/commands/init/formatter-settings.ts';
import { buildImportExtensionTables } from '#cli/commands/init/import-extension.ts';
import { PREFACE_BODY, XCODE_DESTINATIONS } from '#cli/config/commands/init/settings-text.ts';
import { SWIFT_CONFIGURATION, OPENAPI_CONFIGURATION } from '#cli/config/configurations/names.ts';

import type {
    InitAnswers,
    InitOptions,
    SettingsDraft,
    InitConfigurations,
    ScopeConfigurations,
} from '#cli/types/commands/init.ts';

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
                (file) => findScopePath(file.path, draft.scopes) === scope && isDocument(file.path),
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
    const projectFiles = repository.files.filter((each) => each.path.endsWith(PBXPROJ));
    return new Map(
        scopes.flatMap(({ scope, selected }) => {
            if (selected.every((configuration) => configuration.name !== SWIFT_CONFIGURATION)) return [];
            const file = projectFiles.find(
                (projectFile) => findScopePath(projectFile.path, draft.scopes) === scope,
            )?.path;
            if (file === undefined) return [];
            const text = findText(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text).sdkRoot;
            const destination = XCODE_DESTINATIONS.get(sdkRoot);
            const swiftSettings = {
                xcode_project: posix.dirname(file),
                ...stripUndefined({ xcode_destination: destination }),
            };
            return [[scope, { swift: swiftSettings }] as const];
        }),
    );
}

function buildSettingsTable(
    draft: SettingsDraft,
    repository: Repository,
    configurations: Map<string, Configuration>,
): TomlTable {
    const selected = {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: Object.fromEntries(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const scopes = ['', ...draft.scopes.map((each) => each.path)];
    const scopeConfigurations = scopes.map((scopePath) => ({
        scope: scopePath,
        selected: selectForScope(selected, scopePath, configurations),
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
    return {
        ...(draft.level !== undefined && { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...stripUndefined({ scope: scope.length === 0 ? undefined : scope }),
    };
}

/**
Build the gspot.toml text for a settings draft.

@param draft the settings choices.
@param repository the tracked source files.
@param configurations the configurations to choose from.
@returns the TOML text, with the preface comment and the line that names the template.
*/
export function buildInitSettings(
    draft: SettingsDraft,
    repository: Repository,
    configurations: Map<string, Configuration>,
): string {
    const document = buildSettingsTable(draft, repository, configurations);
    if (draft.hooks) setKey(document, 'hooks.enabled', true);
    else Reflect.deleteProperty(document, 'hooks');
    if (draft.ci === 'none') {
        Reflect.deleteProperty(document, 'ci');
    } else {
        setKey(document, 'ci.enabled', true);
        setKey(document, 'ci.provider', draft.ci);
    }
    if (!draft.rules) setKey(document, 'rules.enabled', false);
    return buildSettingsText(
        PREFACE_BODY,
        stripDefaults(document),
        settingsSchema.shape.format.parse(document['format']),
    );
}

/**
Draft the settings from the configuration choices and the init answers.

@param configurations the configurations and scopes.
@param answers the integration choices.
@param options the authored level, when selected.
@returns the root and scope configurations with the answers.
*/
export function buildSettingsDraft(
    configurations: InitConfigurations,
    answers: InitAnswers,
    options: Pick<InitOptions, 'level'>,
): SettingsDraft {
    const scopes = configurations.scopes.filter((scope) => scope.path !== '');
    return {
        configurations: configurations.rootNames,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: configurations.scopeConfigurations.get(scope.path) ?? [],
        })),
        ...answers,
        ...stripUndefined({ level: options.level }),
    };
}
