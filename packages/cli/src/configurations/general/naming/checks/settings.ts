import { splitWords } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { CATEGORY_PARENTS } from '#cli/config/settings/validation.ts';
import type { Scope, Settings, ScopeSettings } from '#cli/types/settings.ts';
import { NAMING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';

import type {
    NamingCase,
    BannedWord,
    NamingOverride,
    NamingSettings,
    CompiledOverride,
    ParsedNamingLanguageFields,
} from '#cli/types/configurations/general.ts';

// JavaScript files follow the naming table of TypeScript, so one set of naming.typescript settings covers both.
const SHARED_NAMING_LANGUAGES: Readonly<Record<string, string>> = { javascript: 'typescript' };

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
    const languageKey = NAMING_LANGUAGES.find((name) => name === language);
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
    return (identifierLanguage, category) => {
        const language = SHARED_NAMING_LANGUAGES[identifierLanguage] ?? identifierLanguage;
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
    origin: Pick<BannedWord, 'setting' | 'list' | 'categories' | 'firstWord' | 'replacement'>,
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
    const replacements = new Map(tables.flatMap((table) => (table === undefined ? [] : Object.entries(table.terms))));
    const terms = [
        ...Object.entries(shipped.lists).flatMap(([group, list]) =>
            compileBannedWords(list.words, {
                setting: `${group.replaceAll('_', ' ')} list`,
                list: group,
                firstWord: list.first_word === true,
                ...(list.categories !== undefined && { categories: list.categories }),
            }),
        ),
        ...compileBannedWords(bannedWords, { setting: 'naming.banned_words' }),
        ...replacements
            .entries()
            .flatMap(([term, replacement]) => compileBannedWords([term], { setting: 'naming.terms', replacement })),
    ];
    const overrides = [
        compileOverride({ allowed_names: shipped.allowed_names }),
        ...shipped.exception.map((override) => compileOverride(override)),
        ...configurations
            .filter((configuration) => configuration.name !== 'naming')
            .flatMap((configuration) =>
                (configuration.naming?.exception ?? []).map((override) => compileOverride(override)),
            ),
        ...settings.naming.exception.map((override) => compileOverride(override)),
    ];
    return {
        bannedWords: terms,
        allowedPhrases: shipped.allowed_phrases.map((phrase) => splitWords(phrase)),
        overrides,
        limitLookup: buildLimitLookup(scopeSettings),
    };
}
