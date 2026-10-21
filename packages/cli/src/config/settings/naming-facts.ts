import type { SettingFacts } from '#cli/types/settings/facts.ts';
import { SETTING_LANGUAGES } from '#cli/config/settings/schema.ts';

export const NAMING_FACTS = {
    'naming.banned_words': {
        configurations: ['naming'],
        description: 'Words this repository bans in identifiers, beyond the shipped groups.',
        default: [] as [],
    },
    'naming.override': {
        configurations: ['naming'],
        description: 'Naming rules for repository-relative paths, in order; each record has its reason.',
        default: [] as [],
    },
    'naming.max_characters': {
        configurations: ['naming'],
        description: 'The most characters one identifier may have.',
        reason_needed: 'raising',
        languages: SETTING_LANGUAGES,
        language_defaults: { swift: 40, sql: 55 },
        default: 35,
    },
    'naming.max_words': {
        configurations: ['naming'],
        description: 'The most words one identifier may have.',
        reason_needed: 'raising',
        languages: SETTING_LANGUAGES,
        language_defaults: { swift: 5, sql: 7 },
        default: 4,
    },
    'naming.cases': {
        configurations: ['naming'],
        description:
            'The case patterns that one identifier category accepts: camel, pascal, kebab, snake, upper-snake, pascal-extension (String+Format.swift), or timestamp-snake (20260103120000_create_users.sql). Ruff checks the case of Python classes, functions, and parameters, and SwiftLint checks Swift types, variables, parameters, and enum cases; this setting covers the rest.',
        reason_needed: 'adding',
        languages: SETTING_LANGUAGES,
        default: [] as [],
    },
} as const satisfies Record<string, SettingFacts>;
