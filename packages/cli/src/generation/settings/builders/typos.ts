import { stringify } from '@decimalturn/toml-patch';
import { getTable } from '#cli/settings/scope-view.ts';
import { findLockfile } from '#cli/repository/files/classify.ts';
import { TOOL_FILE_TOML_FORMAT } from '#cli/config/generation/generate.ts';
import type { IgnoreSection, PlannedToolFile } from '#cli/types/generation/files.ts';

import {
    TYPOS_IGNORED_GLOBS,
    TYPOS_EXCLUDED_ARRAY,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/settings/builders/typos.ts';
import {
    convertToGlobs,
    keepFirstPatterns,
    formatReasonLines,
    buildIgnoreSections,
    listCheckIgnoreSections,
} from '#cli/generation/settings/ignore-files.ts';

// Convert each shared ignore section once, and keep the first reason for a repeated path.
function buildTyposSections(planned: PlannedToolFile): IgnoreSection[] {
    const excludedLockfiles = TYPOS_IGNORED_GLOBS.filter(
        (path) => path === '*.lock' || findLockfile(path) !== undefined,
    );
    const excludedFormats = TYPOS_IGNORED_GLOBS.filter((path) => !excludedLockfiles.includes(path));
    const sections = [
        ...buildIgnoreSections(planned.session),
        ...listCheckIgnoreSections(planned.selection.view, 'spelling/typos'),
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
 * Build the typos file from the settings.
 *
 * @param planned the tool file to build.
 * @returns the spelling dictionaries and reason-grouped exclusions as TOML.
 */
export function buildTyposFile(planned: PlannedToolFile): string {
    const grouped = buildTyposSections(planned);
    const ignoredGlobs = grouped.flatMap((section) => section.patterns);
    const allowed = Object.fromEntries<string>(
        Object.keys(planned.session.settingsFile.settings.allowed_words).map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: getTable(planned.selection.view, 'spelling').locale,
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-words': allowed,
            },
            files: {
                'extend-exclude': ignoredGlobs,
            },
        },
        TOOL_FILE_TOML_FORMAT,
    );
    return text.replace(TYPOS_EXCLUDED_ARRAY, () => serializeIgnoredGlobs(grouped));
}
