import { overlayTable } from '#cli/settings/edit.ts';
import { formatNameList } from '#cli/system/text.ts';
import { RECORD_FIELDS } from '#cli/settings/lookup.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { LEADING_COMMENTS } from '#cli/config/generation.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { formatSettingsCommands } from '#cli/generation/rules.ts';
import { stripDefaults } from '#cli/generation/setup/defaults.ts';
import { readScopeFormat } from '#cli/generation/setup/format.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import type { InitOptions, SettingsDraft } from '#cli/types/generation.ts';
import type { Repository, ProposedConfigurations } from '#cli/types/repository.ts';

function buildSettingsTable(draft: SettingsDraft, repository: Repository): TomlTable {
    const selected = {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: new Map(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const scopes = ['', ...draft.scopes.map((each) => each.path)];
    const scopeConfigurations = scopes.map((scopePath) => ({
        scopePath,
        selected: selectConfigurationsForScope(selected, scopePath),
    }));
    const detected = buildDetectedTables(scopeConfigurations, { repository, scopes: draft.scopes });
    const tables = new Map(
        scopeConfigurations.map((selection) => [
            selection.scopePath,
            { ...detected.get(selection.scopePath), ...readScopeFormat(selection, draft, repository) },
        ]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return overlayTable(draft.template === undefined ? {} : structuredClone(draft.template.table), {
        ...(draft.level !== undefined && { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...draft.carried,
        ...(scope.length > 0 && { scope }),
    });
}

function formatSettingsPreface(): string {
    const records = Object.keys(RECORD_FIELDS)
        .filter((name) => name !== 'ignore')
        .map((name) => `[[${name}]]`);
    return [
        `# Change these settings with ${formatSettingsCommands()}, and the configurations with \`gspot add\` or \`remove\`.`,
        `# Write the ${formatNameList(records)} records by hand.`,
    ].join('\n');
}

/**
Build the gspot.toml text for a settings draft.

@param draft the settings choices.
@param repository the tracked source files.
@returns the TOML text, with the preface and the comments of the copied keys.
*/
export function buildInitSettings(draft: SettingsDraft, repository: Repository): string {
    const document = buildSettingsTable(draft, repository);
    delete document['ci'];
    return `${formatSettingsPreface()}\n${buildSettingsText(draft.base, stripDefaults(document))}`;
}

/**
Draft the settings from the configuration choices.

@param configurations the configurations and scopes.
@param options the authored level, when selected.
@param format what the format settings read from the repository.
@param format.prettierScripts the options of the JavaScript Prettier configs.
@param format.trackedPaths the tracked files and every folder above them.
*/
export function buildSettingsDraft(
    configurations: ProposedConfigurations,
    options: Pick<InitOptions, 'level' | 'template'>,
    { prettierScripts, trackedPaths }: Pick<SettingsDraft, 'prettierScripts' | 'trackedPaths'>,
): SettingsDraft {
    const scopes = configurations.scopes.filter((scope) => scope.path !== '');
    return {
        base: options.template?.text.replace(LEADING_COMMENTS, '') ?? '',
        configurations: configurations.rootNames,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: configurations.scopeConfigurations.get(scope.path) ?? [],
        })),
        level: options.level,
        template: options.template,
        prettierScripts,
        trackedPaths,
    };
}
