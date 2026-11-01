import { GspotError } from '#cli/system/errors.ts';
import { overlayTable } from '#cli/settings/edit.ts';
import type { TomlTable } from '#cli/types/settings.ts';
import { selectForScope } from '#cli/settings/scopes.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { stripDefaults } from '#cli/commands/init/defaults.ts';
import { readScopeFormat } from '#cli/commands/init/format.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { formatSettingsCommands } from '#cli/generation/rules.ts';
import type { InitOptions, SettingsDraft } from '#cli/types/commands/edits.ts';
import type { Repository, InitConfigurations } from '#cli/types/repository.ts';
import { LEADING_COMMENTS, HAND_EDIT_RECORDS } from '#cli/config/commands/edits.ts';

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
    const detected = buildDetectedTables(scopeConfigurations, { repository, scopes: draft.scopes });
    const tables = new Map(
        scopeConfigurations.map((selection) => [
            selection.scope,
            { ...detected.get(selection.scope), ...readScopeFormat(selection, draft, repository) },
        ]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return overlayTable(draft.template === undefined ? {} : structuredClone(draft.template.table), {
        ...(draft.level !== undefined && { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...(scope.length > 0 && { scope }),
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
    const preface = `# Change these settings with ${formatSettingsCommands()}. ${HAND_EDIT_RECORDS}`;
    return `${preface}\n${buildSettingsText(draft.base, stripDefaults(document))}`;
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
        level: options.level,
        template: options.template,
    };
}
