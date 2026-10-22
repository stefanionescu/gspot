import { posix } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { stringify } from '@decimalturn/toml-patch';
import { LOCKFILES } from '#cli/config/parsers/projects/lockfiles.ts';
import { CONFIG_FILE_TOML_FORMAT } from '#cli/config/generation/config-files/build.ts';
import type { IgnoreSection, PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    TYPOS_IGNORED_GLOBS,
    TYPOS_EXCLUDED_ARRAY,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/configurations/general/spelling.ts';
import {
    convertToGlobs,
    formatReasonLines,
    keepFirstPatterns,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/config-files/ignore-files.ts';

// Convert each shared ignore section once, and keep the first reason for a repeated path.
function buildTyposSections(planned: PlannedConfigFile): IgnoreSection[] {
    const excludedLockfiles = TYPOS_IGNORED_GLOBS.filter(
        (path) => path === '*.lock' || LOCKFILES.some((entry) => entry.file === posix.basename(path)),
    );
    const excludedFormats = TYPOS_IGNORED_GLOBS.filter((path) => !excludedLockfiles.includes(path));
    const sections = [
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(planned.scope.settings, 'spelling/typos'),
    ].map((section) => {
        if (section.key === 'lockfiles')
            return {
                ...section,
                patterns: [...section.patterns, ...excludedLockfiles].filter(
                    (path) => path === '*.lock' || !path.endsWith('.lock'),
                ),
            };
        return section.key === 'generators'
            ? { ...section, patterns: [...section.patterns, ...excludedFormats] }
            : section;
    });
    return keepFirstPatterns(
        sections.map((section) => ({
            ...section,
            patterns: convertToGlobs([section]),
        })),
    );
}

// Keep the exclusion-array comments beside their original ordered groups.
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
 * Build typos.toml: the spelling dictionaries and reason-grouped exclusions as TOML.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the spelling dictionaries and reason-grouped exclusions as TOML.
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
