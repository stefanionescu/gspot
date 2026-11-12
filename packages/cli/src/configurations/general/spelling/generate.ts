import { stringify } from '@decimalturn/toml-patch';

import { MESSAGE_FILE_SUFFIX } from '#cli/config/configurations/framework.ts';
import {
    EXTEND_EXCLUDE_LINE,
    LOCKFILE_EXTENSION,
    LOCKFILE_GLOB,
    TYPOS_CHECK,
    TYPOS_FORMAT_GLOBS,
    TYPOS_IGNORE_PATTERNS,
    TYPOS_LOCKFILE_GLOBS,
} from '#cli/config/configurations/prose.ts';
import { TRANSLATIONS_CONFIGURATION } from '#cli/config/settings/detected.ts';
import { CONFIG_TOML_FORMAT } from '#cli/config/tools/installers.ts';
import {
    commentSectionTitle,
    convertToGlobs,
    keepFirstPatterns,
    listPlannedIgnoreSections,
} from '#cli/configurations/ignores.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { escapeGlob } from '#cli/system/paths.ts';
import { compareText } from '#cli/system/text.ts';
import { type ConfigBuilder, type IgnoreSection } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

const ENGLISH_LOCALE_GLOBS = ['en', 'en[-_]*'] as const;

const MESSAGE_FILES_TITLE = 'Message files of other languages than English';

// typos reads every file as English. The section comes first, so that a later path that you ignore still wins.
function listMessageSections({ scope }: PlannedConfig): IgnoreSection[] {
    const folder = scope.settings.tables.translations?.messages_folder;
    if (folder === undefined || !scope.settings.configurations.includes(TRANSLATIONS_CONFIGURATION)) return [];
    const path = escapeGlob(folder);
    const english = ENGLISH_LOCALE_GLOBS.flatMap((locale) => [
        `!${path}/${locale}${MESSAGE_FILE_SUFFIX}`,
        `!${path}/${locale}/**`,
    ]);
    return [
        {
            key: 'configurations',
            title: MESSAGE_FILES_TITLE,
            patterns: [`${path}/**/*${MESSAGE_FILE_SUFFIX}`, ...english],
        },
    ];
}

function buildTyposSections(planned: PlannedConfig): IgnoreSection[] {
    const sections = [...listMessageSections(planned), ...listPlannedIgnoreSections(planned, TYPOS_CHECK)].map(
        (section) => {
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
        },
    );
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
                : [...commentSectionTitle(title, '  '), ...patterns.map((pattern) => `  ${JSON.stringify(pattern)},`)],
        ),
        ']',
    ].join('\n');
}

function buildTyposFile(planned: PlannedConfig): string {
    const spelling = getTable(planned.scope.settings, 'spelling');
    const allowed = Object.fromEntries<string>(
        Object.keys(spelling.allowed_words)
            .toSorted(compareText)
            .map((word) => [word, word]),
    );
    const text = stringify(
        {
            default: {
                locale: spelling.locale,
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
