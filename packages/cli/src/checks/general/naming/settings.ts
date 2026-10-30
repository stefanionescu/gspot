import { splitByCase } from 'scule';
import { getTable } from '#cli/settings/scopes.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { type Settings } from '#cli/types/settings/file.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import type { NamingOverride } from '#cli/types/configurations.ts';
import { type Scope, type ScopeSettings } from '#cli/types/settings/inheritance.ts';
import type { NamingCase, ParsedNamingLanguageFields } from '#cli/types/settings/naming.ts';
import type { BannedWord, NamingSettings, CompiledOverride } from '#cli/types/checks/general/naming.ts';
import { SEPARATORS, NUMERIC_WORDS, DIGIT_BOUNDARY } from '#cli/config/checks/general/naming/settings.ts';
import { CATEGORY_PARENTS, SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/naming.ts';

function compileOverride(override: NamingOverride): CompiledOverride {
    const [languages, categories, allowedNames] = [override.languages, override.categories, override.allowed_names].map(
        (names) => (names === undefined || names.length === 0 ? undefined : new Set(names)),
    );
    return {
        matches: buildPathMatcher(override.paths ?? ['**']),
        languages,
        categories,
        allowedNames,
        digitsAllowed: override.allow_digits === true,
        repeatedWordsAllowed: override.allow_repeated_words === true,
        ignoredPrefix: override.ignored_prefix === undefined ? undefined : new RegExp(override.ignored_prefix, 'u'),
        ignoredNames:
            override.ignored_names_pattern === undefined ? undefined : new RegExp(override.ignored_names_pattern, 'u'),
        cases: override.cases,
    };
}

function getNamingLimits(scopeSettings: ScopeSettings, language: string, category: string) {
    const root = getTable(scopeSettings, 'naming');
    const languageKey = SETTING_LANGUAGES.find((name) => name === language);
    const languageTable: ParsedNamingLanguageFields | undefined =
        languageKey === undefined ? undefined : root[languageKey];
    const categoryKey = NAMING_TABLE_CATEGORIES.find((name) => name === category);
    const categoryTable = categoryKey === undefined ? undefined : languageTable?.[categoryKey];
    return {
        ...root,
        ...languageTable,
        ...categoryTable,
    };
}

function buildLimitLookup(scopeSettings: ScopeSettings): NamingSettings['limitLookup'] {
    return (language, category) => {
        const parent = CATEGORY_PARENTS[category] ?? category;
        const limits = getNamingLimits(scopeSettings, language, parent);
        return {
            cases:
                (scopeSettings.valuesByKey[`naming.${language}.${category}.cases`] as NamingCase[] | undefined) ??
                limits.cases,
            maxCharacters: limits.max_characters,
            maxWords: limits.max_words,
        };
    };
}

function compileBannedWords(
    words: string[],
    origin: Pick<BannedWord, 'setting' | 'list' | 'categories'>,
): BannedWord[] {
    return words
        .map((term) => ({ word: term.trim().toLowerCase(), words: splitWords(term), ...origin }))
        .filter((term) => term.words.length > 0);
}

/**
Join the shipped lists with the repository's additions, exemptions, and limits.

@param settings the authored repository settings.
@param scope the scope, selected configurations, and merged settings.
*/
export function readNamingSettings(settings: Settings, scope: Scope): NamingSettings {
    const { settings: scopeSettings, configurations, path: scopePath } = scope;
    const shipped = readNamingDefaults();
    const tables = listApplicableTables(settings, scopePath).map(({ table }) => table.naming);
    const bannedWords = [...new Set(tables.flatMap((table) => table?.banned_words ?? []))];
    const terms = [
        ...Object.entries(shipped.lists).flatMap(([group, { words: terms }]) =>
            compileBannedWords(terms, {
                setting: `${group} list`,
                list: group,
                ...(group === 'folders' && { categories: ['folders'] }),
            }),
        ),
        ...compileBannedWords(bannedWords, { setting: 'naming.banned_words' }),
    ];
    const overrides = [
        compileOverride({ allowed_names: shipped.allowed_names }),
        ...shipped.override.map((override) => compileOverride(override)),
        ...configurations.flatMap((configuration) =>
            (configuration.naming?.override ?? []).map((override) => compileOverride(override)),
        ),
        ...settings.naming.override.map((override) => compileOverride(override)),
    ];
    return {
        bannedWords: terms,
        allowedPhrases: shipped.allowed_phrases.map((phrase) => splitWords(phrase)),
        overrides,
        limitLookup: buildLimitLookup(scopeSettings),
    };
}

/**
Splits a name into lowercase parts: `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.

@param name the identifier.
*/
export function splitWords(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((word) => (NUMERIC_WORDS.has(word.toLowerCase()) ? [word] : word.split(DIGIT_BOUNDARY)))
        .map((word) => word.toLowerCase())
        .filter((word) => word !== '');
}
