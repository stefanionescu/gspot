import { getTable } from '#cli/settings/tables.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { readNamingDefaults } from '#cli/manifests/read.ts';
import { CATEGORY_PARENTS } from '#cli/config/settings/values.ts';
import { listApplicableTables } from '#cli/settings/values/written.ts';
import { splitWords } from '#cli/configurations/general/naming/words.ts';
import type { Scope, Settings, ScopeSettings } from '#cli/types/settings.ts';
import { SHARED_NAMING_LANGUAGES } from '#cli/config/configurations/naming.ts';
import { NAMING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/tables.ts';

import type {
    BannedWord,
    NamingCase,
    NamingSettings,
    NamingException,
    CompiledException,
    ParsedNamingLanguageFields,
} from '#cli/types/configurations/naming.ts';

function compileException(exception: NamingException): CompiledException {
    const [languages, categories, allowedNames] = [
        exception.languages,
        exception.categories,
        exception.allowed_names,
    ].map((names) => (names === undefined || names.length === 0 ? undefined : new Set(names)));
    return {
        matches: buildPathMatcher(exception.paths ?? ['**']),
        languages,
        categories,
        allowedNames,
        digitsAllowed: exception.allow_digits === true,
        repeatedWordsAllowed: exception.allow_repeated_words === true,
        ignoredPrefix: exception.ignored_prefix === undefined ? undefined : new RegExp(exception.ignored_prefix, 'u'),
        ignoredNames:
            exception.ignored_names_pattern === undefined
                ? undefined
                : new RegExp(exception.ignored_names_pattern, 'u'),
        cases: exception.cases,
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
    origin: Pick<BannedWord, 'setting' | 'list' | 'categories' | 'firstWord' | 'wholeName' | 'replacement'>,
): BannedWord[] {
    return words
        .map((term) => ({ word: term.trim().toLowerCase(), words: splitWords(term), ...origin }))
        .filter((term) => term.words.length > 0);
}

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
                wholeName: list.whole_name === true,
                ...(list.categories !== undefined && { categories: list.categories }),
            }),
        ),
        ...compileBannedWords(bannedWords, { setting: 'naming.banned_words' }),
        ...replacements
            .entries()
            .flatMap(([term, replacement]) => compileBannedWords([term], { setting: 'naming.terms', replacement })),
    ];
    const exceptions = [
        compileException({ allowed_names: shipped.allowed_names }),
        ...shipped.exception.map((exception) => compileException(exception)),
        ...configurations
            .filter((configuration) => configuration.name !== 'naming')
            .flatMap((configuration) =>
                (configuration.naming?.exception ?? []).map((exception) => compileException(exception)),
            ),
        ...settings.naming.exception.map((exception) => compileException(exception)),
    ];
    return {
        bannedWords: terms,
        allowedPhrases: shipped.allowed_phrases.map((phrase) => splitWords(phrase)),
        exceptions,
        limitLookup: buildLimitLookup(scopeSettings),
        isTestFile: buildPathMatcher(scopeSettings.test_files),
    };
}
