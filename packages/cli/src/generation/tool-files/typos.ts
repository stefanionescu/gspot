import { stringify } from '@decimalturn/toml-patch';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { generatedIgnores, selectedIgnorePaths } from '#cli/generation/ignore-files.ts';
import { type TyposSettings, type TyposDictionary, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    TOOL_EMIT_FORMAT,
    TYPOS_EXCLUDED_FILES,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Accept the dictionary keys written in gspot.toml without extending every source-file dictionary.
 *
 * @param spellingScopes the scopes with spelling checks.
 *
 * @returns the settings dictionary and its native file selector.
 */
function buildSettingsDictionary(spellingScopes: ScopeSelection[]) {
    const dictionaries = spellingScopes.flatMap((entry) => {
        const native = entry.view.extra('typos') as TyposSettings | undefined;
        if (native === undefined) return [];
        return [native.default, ...(native.type === undefined ? [] : Object.values(native.type))];
    });
    const collectWords = (key: keyof TyposDictionary): [string, string][] =>
        dictionaries.flatMap((dictionary) => {
            const words = dictionary?.[key];
            return words === undefined ? [] : Object.keys(words).map((word): [string, string] => [word, word]);
        });
    return {
        'extend-glob': [SETTINGS_FILE],
        'extend-identifiers': Object.fromEntries<string>(collectWords('extend-identifiers')),
        'extend-words': Object.fromEntries<string>(collectWords('extend-words')),
    };
}
/**
 * Build typos file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the spelling dictionaries and reason-grouped exclusions as TOML.
 */
function buildTyposFile(context: ToolFileContext): string {
    const { settings, ignoresFor, extra } = context.selection.view;
    const ignoredPaths = [
        ...generatedIgnores(context.session),
        ...selectedIgnorePaths(context.scopes).filter((path) => !path.endsWith('/')),
    ];
    const typos = extra('typos') as TyposSettings | undefined;
    const allowed = Object.fromEntries<string>(
        context.session.settingsFile.settings.allowed_words.map((word) => [word, word]),
    );
    const spellingScopes = context.scopes
        .filter(({ view }) => view.configurations.includes('spelling'))
        .toSorted((left, right) => compareScopeDepth(left.scope.path, right.scope.path));
    const settingsType = buildSettingsDictionary(spellingScopes);
    const types = Object.fromEntries<TyposDictionary>(
        (typos?.type === undefined ? [] : Object.entries(typos.type)).map(([name, dictionary]) => [
            name,
            dictionary['extend-glob']?.includes(SETTINGS_FILE) === true
                ? {
                      ...dictionary,
                      'extend-identifiers': {
                          ...dictionary['extend-identifiers'],
                          ...settingsType['extend-identifiers'],
                      },
                      'extend-words': { ...dictionary['extend-words'], ...settingsType['extend-words'] },
                  }
                : dictionary,
        ]),
    );
    return stringify(
        {
            default: {
                locale: settings['spelling.locale'],
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-identifiers': { ...allowed, ...typos?.default?.['extend-identifiers'] },
                'extend-words': { ...allowed, ...typos?.default?.['extend-words'] },
            },
            files: {
                'extend-exclude': [
                    ...new Set([
                        ...TYPOS_EXCLUDED_FILES,
                        ...ignoresFor('spelling/typos')
                            .filter((entry) => entry.rule === undefined)
                            .flatMap((entry) => entry.paths),
                        ...ignoredPaths,
                    ]),
                ],
            },
            type: {
                ...types,
                'gspot-settings': settingsType,
            },
        },
        TOOL_EMIT_FORMAT,
    );
}

export { buildTyposFile };
