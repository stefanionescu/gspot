import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { stringify } from '@decimalturn/toml-patch';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/toml.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    convertToGlobs,
    keepFirstPatterns,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';
import {
    TYPOS_CHECK,
    LOCKFILE_GLOB,
    TYPOS_FORMAT_GLOBS,
    LOCKFILE_EXTENSION,
    EXTEND_EXCLUDE_LINE,
    TYPOS_LOCKFILE_GLOBS,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/configurations/general.ts';

function buildTyposSections(planned: PlannedConfigFile): IgnoreSection[] {
    const sections = [
        ...buildIgnoreSections(planned.session),
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
export function buildTyposFile(planned: PlannedConfigFile): string {
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
        CONFIG_FILE_TOML_FORMAT,
    );
    return [text, '[files]', serializeIgnoredGlobs(buildTyposSections(planned))].join('\n');
}
