import { stringify } from '@decimalturn/toml-patch';
import { getTable } from '#cli/settings/scope-view.ts';
import { findLockfile } from '#cli/repository/classify.ts';
import { type IgnoreSection, type ToolFileContext } from '#cli/types/generation/files.ts';

import {
    TOML_FORMAT,
    TYPOS_EXCLUDED_FILES,
    TYPOS_EXCLUDED_ARRAY,
    TYPOS_IGNORE_PATTERNS,
} from '#cli/config/generation/settings.ts';
import {
    keepFirstPatterns,
    formatReasonLines,
    buildGlobSections,
    buildIgnoreSections,
    buildSettingsSections,
} from '#cli/generation/ignore-files.ts';

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
            patterns: buildGlobSections([section]),
        })),
    );
}

// Keep the exclusion-array comments beside their original ordered groups.
function serializeExclusions(grouped: IgnoreSection[]): string {
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
 * @param context the tool file to build.
 * @returns the spelling dictionaries and reason-grouped exclusions as TOML.
 */
function buildTyposFile(context: ToolFileContext): string {
    const grouped = buildTyposSections(context);
    const ignoredPaths = grouped.flatMap((section) => section.patterns);
    const allowed = Object.fromEntries<string>(
        Object.keys(context.session.settingsFile.settings.allowed_words).map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: getTable(context.selection.view, 'spelling').locale,
                'extend-ignore-re': TYPOS_IGNORE_PATTERNS,
                'extend-words': allowed,
            },
            files: {
                'extend-exclude': ignoredPaths,
            },
        },
        TOML_FORMAT,
    );
    return text.replace(TYPOS_EXCLUDED_ARRAY, () => serializeExclusions(grouped));
}

export { buildTyposFile };
