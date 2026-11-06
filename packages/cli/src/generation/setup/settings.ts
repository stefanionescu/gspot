import { LEADING_COMMENTS } from '#cli/config/generation.ts';
import { stripDefaults } from '#cli/generation/setup/defaults.ts';
import { readScopeFormat } from '#cli/generation/setup/format.ts';
import { selectConfigurations } from '#cli/manifests/select.ts';
import { listAutomaticConfigurations } from '#cli/repository/detect.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { overlayTable, removeKey } from '#cli/settings/edit.ts';
import { findSetting, listWrittenKeys } from '#cli/settings/inherit.ts';
import { buildSettings } from '#cli/settings/read.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import type { InitOptions, SettingsDraft, Template } from '#cli/types/generation.ts';
import type { ProposedConfigurations, Repository } from '#cli/types/repository.ts';
import type { TomlTable } from '#cli/types/settings.ts';

const UNREAD_SETTING_NOTE = 'no selected configuration reads it';

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

function leaveOutUnreadSettings(template: Template, configurations: ProposedConfigurations): Template {
    const offered = buildAvailableSettings(
        selectConfigurations([
            ...configurations.rootNames,
            ...configurations.scopeConfigurations.values().toArray().flat(),
            ...listAutomaticConfigurations(),
        ]),
        'basic',
    );
    const table = structuredClone(template.table);
    const written = buildSettings(settingsSchema.parse(table), table);
    const unread = listWrittenKeys(written, offered).filter((key) => findSetting(offered, key) === undefined);
    for (const key of unread) removeKey(table, key);
    return {
        ...template,
        table,
        leftOut: [...template.leftOut, ...unread.map((key) => ({ key, note: UNREAD_SETTING_NOTE }))],
    };
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
    return `${[
        '# Change these settings with `gspot set`, `unset`, `ignore`, or `unignore`, and the configurations with `gspot add` or `remove`.',
        '# Run gspot list settings to see each setting. Records such as [[scope]] and [[command_check]] are written by hand.',
    ].join('\n')}\n${buildSettingsText(draft.base, stripDefaults(document))}`;
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
    const template =
        options.template === undefined ? undefined : leaveOutUnreadSettings(options.template, configurations);
    return {
        base: template?.text.replace(LEADING_COMMENTS, '') ?? '',
        configurations: configurations.rootNames,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: configurations.scopeConfigurations.get(scope.path) ?? [],
        })),
        level: options.level,
        template,
        prettierScripts,
        trackedPaths,
    };
}
