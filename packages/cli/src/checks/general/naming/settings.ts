import { splitByCase } from 'scule';
import { getTable } from '#cli/settings/scopes.ts';
import { stripUndefined } from '#cli/system/tables.ts';
import { type Settings } from '#cli/types/settings/file.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import { readNamingDefaults } from '#cli/configurations/naming.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { type Scope, type ScopeSettings } from '#cli/types/settings/inheritance.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/naming.ts';
import type { NamingCase, ParsedNamingLanguageFields } from '#cli/types/settings/naming.ts';
import type { BannedWord, NamingOverride, NamingSettings, CompiledOverride } from '#cli/types/checks/general/naming.ts';

import {
    SEPARATORS,
    NUMERIC_WORDS,
    DIGIT_BOUNDARY,
    CATEGORY_PARENTS,
} from '#cli/config/checks/general/naming/settings.ts';

function compileOverride(rule: NamingOverride): CompiledOverride {
    const [languages, categories, allowedNames] = [rule.languages, rule.categories, rule.allowed_names].map((names) =>
        names === undefined || names.length === 0 ? undefined : new Set(names),
    );
    return {
        matches: buildPathMatcher(rule.paths ?? ['**']),
        languages,
        categories,
        allowedNames,
        isDigitsAllowed: rule.allow_digits === true,
        isRepeatAllowed: rule.allow_repeated_words === true,
        ignoredPrefix: rule.ignored_prefix === undefined ? undefined : new RegExp(rule.ignored_prefix, 'u'),
        ignoredNames:
            rule.ignored_names_pattern === undefined ? undefined : new RegExp(rule.ignored_names_pattern, 'u'),
        cases: rule.cases,
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
        ...(languageTable === undefined ? undefined : stripUndefined(languageTable)),
        ...(categoryTable === undefined ? undefined : stripUndefined(categoryTable)),
    };
}

function buildLimitsFor(scopeSettings: ScopeSettings): NamingSettings['limitsFor'] {
    const parents: Readonly<Record<string, string>> = CATEGORY_PARENTS;

    return (language, category) => {
        const parent = parents[category] ?? category;
        const limits = getNamingLimits(scopeSettings, language, parent);
        return {
            caseNames:
                (scopeSettings.settings[`naming.${language}.${category}.cases`] as NamingCase[] | undefined) ??
                limits.cases,
            maxChars: limits.max_characters,
            maxWords: limits.max_words,
        };
    };
}

function compileBannedWords(
    terms: string[],
    origin: Pick<BannedWord, 'setting' | 'group' | 'categories'>,
): BannedWord[] {
    return terms
        .map((term) => ({ word: term.trim().toLowerCase(), words: splitWords(term), ...origin }))
        .filter((term) => term.words.length > 0);
}

/**
Reads the naming settings of a scope: the shipped lists plus the repository additions, exemptions, and limits.

@param settings the authored repository settings.
@param scope the scope, selected configurations, and merged settings.
@returns the word lists, exemptions, and limits.
*/
export function readNamingSettings(settings: Settings, scope: Scope): NamingSettings {
    const {
        settings: scopeSettings,
        configurations,
        folder: { path: scopePath },
    } = scope;
    const shipped = readNamingDefaults();
    const tables = listApplicableTables(settings, scopePath).map(({ table }) => table.naming);
    const bannedWords = [...new Set(tables.flatMap((table) => table?.banned_words ?? []))];
    const terms = [
        ...Object.entries(shipped.groups).flatMap(([group, { terms }]) =>
            compileBannedWords(terms, {
                setting: `${group} group`,
                group,
                ...(group === 'folders' ? { categories: ['folders'] } : {}),
            }),
        ),
        ...compileBannedWords(bannedWords, { setting: 'naming.banned_words' }),
    ];
    const overrides = [
        compileOverride({ allowed_names: shipped.allowed_names }),
        ...shipped.override.map((override) => compileOverride(override)),
        ...configurations.flatMap((configuration) =>
            (configuration.naming?.override ?? []).map((override) => compileOverride(stripUndefined(override))),
        ),
        ...settings.naming.override.map((override) => compileOverride(override)),
    ];
    return {
        bannedWords: terms,
        allowedPhrases: shipped.allowed_phrases.map((phrase) => splitWords(phrase)),
        reserved: new Map(
            Object.entries(shipped.reserved).map(([term, categories]) => [term.toLowerCase(), categories]),
        ),
        overrides,
        limitsFor: buildLimitsFor(scopeSettings),
        isDigitsAllowed: shipped.allow_digits,
        isRepeatAllowed: shipped.allow_repeated_words,
    };
}

/**
Splits a name into lowercase parts: `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.

@param name the identifier.
@returns the lowercase words and digit groups.
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
