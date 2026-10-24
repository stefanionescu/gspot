import { getTable } from '#cli/settings/scopes.ts';
import { stringify } from '@decimalturn/toml-patch';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    convertToGlobs,
    formatReasonLines,
    keepFirstPatterns,
    listIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';
import {
    TYPOS_FORMAT_GLOBS,
    TYPOS_LOCKFILE_GLOBS,
    TYPOS_EXCLUDED_ARRAY,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/configurations/general/spelling.ts';

function buildTyposSections(planned: PlannedConfigFile): IgnoreSection[] {
    const sections = listIgnoreSections(planned, 'spelling/typos').map((section) => {
        if (section.key === 'lockfiles')
            return {
                ...section,
                patterns: [...section.patterns, ...TYPOS_LOCKFILE_GLOBS].filter(
                    (path) => path === '*.lock' || !path.endsWith('.lock'),
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

function serializeIgnoredGlobs(grouped: IgnoreSection[]): string {
    return [
        'extend-exclude = [',
        ...grouped.flatMap(({ title, patterns }) =>
            patterns.length === 0
                ? []
                : [...formatReasonLines(title, '  '), ...patterns.map((pattern) => `  ${JSON.stringify(pattern)},`)],
        ),
        ']',
    ].join('\n');
}

/**
Build typos.toml: the spelling dictionaries and reason-grouped exclusions as TOML.

@param planned the config file with its scope, level, and target path.
@returns the spelling dictionaries and reason-grouped exclusions as TOML.
*/
export function buildTyposFile(planned: PlannedConfigFile): string {
    const grouped = buildTyposSections(planned);
    const ignoredGlobs = grouped.flatMap((section) => section.patterns);
    const allowed = Object.fromEntries<string>(
        Object.keys(getTable(planned.scope.settings, 'spelling').allowed_words).map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: getTable(planned.scope.settings, 'spelling').locale,
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-words': allowed,
            },
            files: {
                'extend-exclude': ignoredGlobs,
            },
        },
        CONFIG_FILE_TOML_FORMAT,
    );
    return text.replace(TYPOS_EXCLUDED_ARRAY, () => serializeIgnoredGlobs(grouped));
}
