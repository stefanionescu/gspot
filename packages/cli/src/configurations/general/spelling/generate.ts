import { stringify } from '@decimalturn/toml-patch';

import {
    EXTEND_EXCLUDE_LINE,
    LOCKFILE_EXTENSION,
    LOCKFILE_GLOB,
    TYPOS_CHECK,
    TYPOS_FORMAT_GLOBS,
    TYPOS_IGNORE_PATTERNS,
    TYPOS_LOCKFILE_GLOBS,
} from '#cli/config/configurations/prose.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import { convertToGlobs, keepFirstPatterns, listCheckIgnoreSections } from '#cli/configurations/ignores.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { compareText } from '#cli/system/text.ts';
import { type ConfigBuilder, type IgnoreSection } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

// gspot writes most of gspot.toml, and it holds globs and tool names that read as misspelled words.
const SETTINGS_SECTION: IgnoreSection = { key: 'settings', title: 'The settings of gspot', patterns: ['gspot.toml'] };

function buildTyposSections(planned: PlannedConfig): IgnoreSection[] {
    const sections = [
        SETTINGS_SECTION,
        ...planned.ignoreSections,
        ...listCheckIgnoreSections(planned.scope.settings, TYPOS_CHECK),
    ].map((section) => {
        if (section.key === 'lockfiles')
            return {
                ...section,
                patterns: [...section.patterns, ...TYPOS_LOCKFILE_GLOBS].filter(
                    (path) => path === LOCKFILE_GLOB || !path.endsWith(LOCKFILE_EXTENSION),
                ),
            };
        return section.key === 'generators'
            ? { ...section, patterns: [...section.patterns, ...TYPOS_FORMAT_GLOBS] }
            : section;
    });
    return keepFirstPatterns(
        sections.map((section) => ({
            ...section,
            patterns: convertToGlobs([section]),
        })),
    );
}

function serializeIgnoredGlobs(sections: IgnoreSection[]): string {
    return [
        EXTEND_EXCLUDE_LINE,
        ...sections.flatMap(({ title, patterns }) =>
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
Build typos.toml: the spelling dictionaries and reason-grouped exclusions as TOML.

@param planned the config file to build.
*/
function buildTyposFile(planned: PlannedConfig): string {
    const allowed = Object.fromEntries<string>(
        Object.keys(getTable(planned.scope.settings, 'spelling').allowed_words)
            .toSorted(compareText)
            .map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: getTable(planned.scope.settings, 'spelling').locale,
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-words': allowed,
            },
        },
        CONFIG_TOML_FORMAT,
    );
    return [text, '[files]', serializeIgnoredGlobs(buildTyposSections(planned))].join('\n');
}

export const SPELLING_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'spelling/typos.toml': buildTyposFile,
};
