import { stringify } from '@decimalturn/toml-patch';
import { findLockfile } from '#cli/repository/classify.ts';
import { compareScopeDepth } from '#cli/repository/scopes.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import type { ScopeSelection } from '#cli/types/settings/values.ts';
import { IGNORE_SECTION_TITLES } from '#cli/config/generation/ignore-files.ts';
import { buildGlobSections, buildIgnoreSections, buildSettingsSections } from '#cli/generation/ignore-files.ts';

import {
    type IgnoreSection,
    type TyposSettings,
    type TyposDictionary,
    type ToolFileContext,
} from '#cli/types/generation/files.ts';
import {
    TOML_FORMAT,
    TYPOS_EXCLUDED_FILES,
    TYPOS_EXCLUDED_ARRAY,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/tool-files.ts';

/**
 * Accept the dictionary keys written in gspot.toml without extending every source-file dictionary.
 *
 * @param spellingScopes the projects where typos runs.
 *
 * @returns the settings dictionary and its file selector.
 */
function buildSettingsDictionary(spellingScopes: ScopeSelection[]) {
    const dictionaries = spellingScopes.flatMap((entry) => {
        const extraOptions = entry.view.extra('typos') as TyposSettings | undefined;
        if (extraOptions === undefined) return [];
        return [extraOptions.default, ...(extraOptions.type === undefined ? [] : Object.values(extraOptions.type))];
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
// Convert each shared ignore section once, and keep the first reason for a repeated path.
function buildTyposSections(context: ToolFileContext): IgnoreSection[] {
    const excludedLockfiles = TYPOS_EXCLUDED_FILES.filter(
        (path) => path === '*.lock' || findLockfile(path) !== undefined,
    );
    const excludedFormats = TYPOS_EXCLUDED_FILES.filter((path) => !excludedLockfiles.includes(path));
    const sections = [
        ...buildIgnoreSections(context.session),
        ...buildSettingsSections(context.selection.view, 'spelling/typos'),
    ].map((section) => {
        if (section.title === IGNORE_SECTION_TITLES.lockfiles)
            return {
                ...section,
                patterns: [...section.patterns, ...excludedLockfiles].filter(
                    (path) => path === '*.lock' || !path.endsWith('.lock'),
                ),
            };
        return section.title === IGNORE_SECTION_TITLES.generators
            ? { ...section, patterns: [...section.patterns, ...excludedFormats] }
            : section;
    });
    const seen = new Set<string>();
    const grouped: IgnoreSection[] = sections.map((section) => ({
        ...section,
        patterns: buildGlobSections([section]).filter((path) => {
            if (seen.has(path)) return false;
            seen.add(path);
            return true;
        }),
    }));
    return grouped;
}

// Merge words used in settings without extending unrelated source-file dictionaries.
function buildSpellingTypes(
    context: ToolFileContext,
    typos: TyposSettings | undefined,
): Record<string, TyposDictionary> {
    const spellingScopes = context.session.scopes
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
    return { ...types, 'gspot-settings': settingsType };
}

// Keep the exclusion-array comments beside their original ordered groups.
function serializeExclusions(grouped: IgnoreSection[]): string {
    return [
        'extend-exclude = [',
        ...grouped.flatMap(({ title, patterns }) =>
            patterns.length === 0
                ? []
                : [
                      ...title
                          .replaceAll('\r\n', '\n')
                          .replaceAll('\r', '\n')
                          .split('\n')
                          .map((line) => `  # ${line}`),
                      ...patterns.map((pattern) => `  ${JSON.stringify(pattern)},`),
                  ],
        ),
        ']',
    ].join('\n');
}

/**
 * Build the typos file from the settings.
 * @param context the tool file to build.
 * @returns the spelling dictionaries and reason-grouped exclusions as TOML.
 */
function buildTyposFile(context: ToolFileContext): string {
    const { settings, extra } = context.selection.view;
    const grouped = buildTyposSections(context);
    const ignoredPaths = grouped.flatMap((section) => section.patterns);
    const typos = extra('typos') as TyposSettings | undefined;
    const allowed = Object.fromEntries<string>(
        Object.keys(context.session.settingsFile.settings.allowed_words).map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: settings['spelling.locale'],
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-identifiers': { ...allowed, ...typos?.default?.['extend-identifiers'] },
                'extend-words': { ...allowed, ...typos?.default?.['extend-words'] },
            },
            files: {
                'extend-exclude': ignoredPaths,
            },
            type: buildSpellingTypes(context, typos),
        },
        TOML_FORMAT,
    );
    return text.replace(TYPOS_EXCLUDED_ARRAY, () => serializeExclusions(grouped));
}

export { buildTyposFile };
