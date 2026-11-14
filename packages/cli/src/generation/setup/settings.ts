import type { TomlTable } from '#cli/types/settings.ts';
import { overlayTable } from '#cli/settings/toml/edit.ts';
import { buildSettingsText } from '#cli/settings/toml/text.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { stripDefaults } from '#cli/generation/setup/defaults.ts';
import { LEADING_COMMENTS } from '#cli/config/generation/setup.ts';
import { SETTINGS_PREFACE_LINES } from '#cli/config/settings/file.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { readScopeFormat } from '#cli/generation/setup/format/prettier.ts';
import { leaveOutUnreadSettings } from '#cli/generation/setup/template.ts';
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

export function buildInitSettings(draft: SettingsDraft, repository: Repository): string {
    const document = buildSettingsTable(draft, repository);
    delete document['ci'];
    return `${SETTINGS_PREFACE_LINES.join('\n')}\n${buildSettingsText(draft.base, stripDefaults(document))}`;
}

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
