import { openSession } from '#cli/session.ts';
import { findRoot } from '#cli/repository/read.ts';
import { GspotError } from '#cli/system/errors.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { parseSettings } from '#cli/settings/read.ts';
import { findDeclaration } from '#cli/settings/inherit.ts';
import { selectForScope } from '#cli/repository/coverage.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import type { SettingsEdit } from '#cli/types/settings/edits.ts';
import { formatUnknownSetting } from '#cli/settings/validation/keys.ts';
import { findScopeTable, readSettingsEdit } from '#cli/settings/edit.ts';
import { refuseAlwaysSelected, assertKnownConfigurations } from '#cli/configurations/select.ts';
import type { PreparedSettingsEdit, ConfigurationsOptions } from '#cli/types/commands/settings.ts';

import {
    type Settings,
    type KnownSettings,
    type ScopeSelection,
    type DeclarationMatch,
} from '#cli/types/settings/values.ts';

/**
 * Read and validate the settings once before a command edits them.
 *
 * @param cwd the folder where the command starts.
 * @returns the starting state of one edit.
 */
export function startSettingsEdit(cwd: string): PreparedSettingsEdit {
    const root = findRoot(cwd);
    const input = readSettingsEdit(root);
    const reads = createReadCache(root);
    const settings = parseSettings(input.text, root);
    return { root, input, settings, reads };
}

/**
 * Validate the configuration names and the scope for add and remove before either command edits a list.
 *
 * @param options where the command starts, the configurations, and the scope.
 * @returns the validated edit, the scope's own lists and effective selection, and the shipped manifests.
 */
export function startConfigurationEdit(options: ConfigurationsOptions): {
    root: string;
    input: SettingsEdit;
    settings: Settings;
    scopeSettings: Pick<Settings, 'configurations' | 'removed_configurations'>;
    selected: string[];
    manifests: Map<string, Manifest>;
} {
    const edit = startSettingsEdit(options.cwd);
    const manifests = readManifests();
    assertKnownConfigurations(options.configurations, manifests);
    refuseAlwaysSelected(options.configurations, manifests);
    findScopeTable(edit.input.table, options.scope);
    const scopeSettings =
        options.scope === undefined
            ? edit.settings
            : (edit.settings.scopes[options.scope] as Settings['scopes'][string]);
    const selected = selectForScope(edit.settings, options.scope ?? '', manifests).map(
        (manifest) => manifest.configuration.name,
    );
    const { root, input, settings } = edit;
    return { root, input, settings, scopeSettings, selected, manifests };
}

/**
 * Look up a setting in one scope with the configurations that the session selects, including the ones that the
 * files of the repository select.
 *
 * @param edit the state from before the edit.
 * @param edit.root the repository root.
 * @param edit.input the settings text and table before the edit.
 * @param edit.settings the parsed gspot.toml before the edit.
 * @param edit.reads the file cache for the lookup.
 * @param key the dotted setting name.
 * @param scope the folder to look in, or the root when absent.
 * @returns the declaration and defaults for that scope.
 */
export async function findSettingDeclaration(
    edit: PreparedSettingsEdit,
    key: string,
    scope: string | undefined,
): Promise<{ known: KnownSettings; match: DeclarationMatch }> {
    if (['configurations', 'removed_configurations'].includes(key))
        throw new GspotError('arguments', 'Use gspot add or gspot remove to change configurations.');
    findScopeTable(edit.input.table, scope);
    const { settings, reads } = edit;
    const session = await openSession(edit.root, { settingsFile: { settings, text: edit.input.text }, reads });
    const known = (session.scopes.find((selection) => selection.scope.path === (scope ?? '')) as ScopeSelection).known;
    const match = findDeclaration(known, key);
    if (match === undefined) {
        const selectedScope = session.scopes.find(
            (selection) =>
                Object.hasOwn(settings.scopes, selection.scope.path) &&
                findDeclaration(selection.known, key) !== undefined,
        )?.scope.path;
        if (selectedScope !== undefined)
            throw new GspotError(
                'arguments',
                `A configuration has the setting \`${key}\` in the scope \`${selectedScope}\`; add --scope ${quoteArgument(selectedScope)}.`,
            );
        throw new GspotError('arguments', formatUnknownSetting(known, key));
    }
    return { known, match };
}
