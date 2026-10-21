import { posix } from 'node:path';
import { setKey } from '#cli/settings/edit.ts';
import { findText } from '#cli/system/files/reads.ts';
import { PBXPROJ } from '#cli/config/parsers/xcode.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { parseBuildSettings } from '#cli/parsers/xcode.ts';
import { PREFACE_BODY } from '#cli/config/commands/init.ts';
import { findScopeFolder } from '#cli/repository/scopes.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#cli/settings/text/build.ts';
import { selectForScope } from '#cli/settings/scope-settings.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { buildFilenameMatcher } from '#cli/repository/matchers.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { XCODE_DESTINATIONS } from '#cli/config/settings/defaults.ts';
import { readFormatTables } from '#cli/commands/init/formatter-settings.ts';
import { buildSelectedConfigurations } from '#cli/commands/init/selection.ts';
import { buildImportExtensionTables } from '#cli/commands/init/import-extension.ts';
import { SWIFT_CONFIGURATION, OPENAPI_CONFIGURATION } from '#cli/config/configurations.ts';
import type { InitAnswers, InitOptions, SettingsDraft, InitConfigurations } from '#cli/types/commands/init.ts';

function buildOpenApiTables(
    scopes: { scope: string; selected: Configuration[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const openapiSelections = scopes
        .map(({ scope, selected: configurations }) => ({
            scope,
            openapi: configurations.find((entry) => entry.name === OPENAPI_CONFIGURATION),
        }))
        .filter((entry): entry is typeof entry & { openapi: Configuration } => entry.openapi !== undefined);
    return new Map(
        openapiSelections.flatMap(({ scope, openapi }) => {
            const isDocument = buildFilenameMatcher(openapi.detect.filenames);
            const document = repository.files.find(
                (file) => findScopeFolder(file.path, draft.scopes).path === scope && isDocument(file.path),
            )?.path;
            return document === undefined ? [] : [[scope, { openapi: { document } }] as const];
        }),
    );
}

// Swift seeds come from the Xcode project owned by each selected scope.
function buildSwiftTables(
    scopes: { scope: string; selected: Configuration[] }[],
    draft: SettingsDraft,
    repository: Repository,
): Map<string, TomlTable> {
    const projectFiles = repository.files.filter((entry) => entry.path.endsWith(PBXPROJ));
    const swiftFiles = scopes.flatMap(({ scope, selected: configurations }) => {
        if (!configurations.some((entry) => entry.name === SWIFT_CONFIGURATION)) return [];
        const file = projectFiles.find((entry) => findScopeFolder(entry.path, draft.scopes).path === scope)?.path;
        return file === undefined ? [] : [{ scope, file }];
    });
    return new Map(
        swiftFiles.map(({ scope, file }) => {
            const text = findText(repository.root, file);
            const sdkRoot = text === undefined ? undefined : parseBuildSettings(text).sdkRoot;
            const destination = XCODE_DESTINATIONS.get(sdkRoot);
            const swiftSettings = {
                xcode_project: posix.dirname(file),
                ...stripUndefined({ xcode_destination: destination }),
            };
            return [scope, { swift: swiftSettings }];
        }),
    );
}

function buildSettingsTable(
    draft: SettingsDraft,
    repository: Repository,
    configurations: Map<string, Configuration>,
): TomlTable {
    const selected = buildSelectedConfigurations(draft);
    const scopes = ['', ...draft.scopes.map((entry) => entry.path)];
    const scopeConfigurations = scopes.map((scopePath) => ({
        scope: scopePath,
        selected: selectForScope(selected, scopePath, configurations),
    }));
    const projects = buildSwiftTables(scopeConfigurations, draft, repository);
    const formats = readFormatTables(draft, repository, configurations);
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
        ...(draft.level === undefined ? {} : { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...stripUndefined({ scope: scope.length === 0 ? undefined : scope }),
    };
}

/**
 * Build the gspot.toml text for a settings draft.
 *
 * @param draft the settings choices.
 * @param repository the tracked source files.
 * @param configurations the configurations to choose from.
 * @returns TOML with its schema line and preface.
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
    return buildSettingsText(PREFACE_BODY, document);
}

/**
 * Draft the settings from the configuration choices and the init answers.
 *
 * @param configurations the configurations and scopes.
 * @param answers the integration choices.
 * @param options the authored level, when selected.
 * @returns the root and scope choices: the answers and the inferred commit scopes.
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
