import { splitByCase } from 'scule';
import { stripUndefined } from '#cli/system/values.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import { readNamingDefaults } from '#cli/configurations/manifests.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import { SEPARATORS, NUMERIC_WORDS, DIGIT_BOUNDARY, CATEGORY_PARENTS } from '#cli/config/checks/general/naming.ts';

import type {
    BannedWord,
    NamingDefaults,
    NamingOverride,
    NamingSettings,
    CompiledOverride,
    NamingDefaultsLanguage,
} from '#cli/types/checks/general.ts';

function collectNames(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

function compileOverride(rule: NamingOverride, source: string): CompiledOverride {
    return {
        matches: buildPathMatcher(rule.paths ?? ['**']),
        languages: collectNames(rule.languages),
        categories: collectNames(rule.categories),
        allowedNames: collectNames(rule.allowed_names),
        isDigitsAllowed: rule.allow_digits === true,
        isRepeatAllowed: rule.allow_repeated_words === true,
        ignoredPrefix: rule.ignored_prefix === undefined ? undefined : new RegExp(rule.ignored_prefix, 'u'),
        cases: rule.cases,
        origin: source,
    };
}

function getNamingLimits(view: Pick<ScopeView, 'options'>, language: string, category: string) {
    const root = view.options('naming');
    const languageKey = SETTING_LANGUAGES.find((name) => name === language);
    const languageTable = languageKey === undefined ? undefined : root[languageKey];
    const categoryKey = NAMING_TABLE_CATEGORIES.find((name) => name === category);
    const categoryTable = categoryKey === undefined ? undefined : languageTable?.[categoryKey];
    return {
        ...root,
        ...(languageTable === undefined ? undefined : stripUndefined(languageTable)),
        ...(categoryTable === undefined ? undefined : stripUndefined(categoryTable)),
    };
}

function listDefaultCases(shipped: NamingDefaults, language: string, category: string, parent: string) {
    const table: NamingDefaultsLanguage | undefined = shipped.languages[language];
    for (const name of [category, parent]) {
        const cases = table?.categories[name]?.cases;
        if (cases !== undefined) return cases;
    }
    return [];
}

function buildLimitsFor(shipped: NamingDefaults, view: Pick<ScopeView, 'options'>): NamingSettings['limitsFor'] {
    const parents: Readonly<Record<string, string>> = CATEGORY_PARENTS;

    return (language, category) => {
        const parent = parents[category] ?? category;
        const limits = getNamingLimits(view, language, parent);
        const defaults = listDefaultCases(shipped, language, category, parent);
        return {
            caseNames: limits.cases.length > 0 ? limits.cases : defaults,
            maxChars: limits.max_characters,
            maxWords: limits.max_words,
        };
    };
}

/**
 * Splits banned words into parts.
 * @param terms the banned words as written.
 * @param origin the setting and group that the words come from.
 * @returns the split words, without empty ones.
 */
function compileBannedWords(
    terms: string[],
    origin: Pick<BannedWord, 'setting' | 'group' | 'categories'>,
): BannedWord[] {
    return terms
        .map((term) => ({ word: term.trim().toLowerCase(), parts: splitParts(term), ...origin }))
        .filter((term) => term.parts.length > 0);
}

/**
 * Reads the naming settings of a scope: the shipped lists plus the repository additions, exemptions, and limits.
 * @param input the scope and settings file.
 * @returns the naming settings.
 */
export function readNamingSettings(
    input: Pick<CheckInput, 'reads'> & {
        scope: Pick<CheckInput['scope'], 'view' | 'selected'> & {
            scope: Pick<CheckInput['scope']['scope'], 'path'>;
        };
        settingsFile: Pick<CheckInput['settingsFile'], 'settings'>;
    },
): NamingSettings {
    const {
        view,
        selected: manifests,
        scope: { path: scope },
    } = input.scope;
    const settings = input.settingsFile.settings;
    const reads = input.reads;
    const shipped = readNamingDefaults(reads);
    const tables = listApplicableTables(settings, scope).map(({ table }) => table.naming);
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
        compileOverride({ allowed_names: shipped.allowed_names }, 'shipped allowed names'),
        ...shipped.override.map((override, index) => compileOverride(override, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.override ?? []).map((override) =>
                compileOverride(stripUndefined(override), `the ${manifest.configuration.name} configuration`),
            ),
        ),
        ...settings.naming.override.map((override, index) =>
            compileOverride(override, `[[naming.override]] record ${String(index + 1)}`),
        ),
    ];
    return {
        bannedWords: terms,
        allowedPhrases: shipped.allowed_phrases.map((phrase) => splitParts(phrase)),
        reserved: new Map(
            Object.entries(shipped.reserved).map(([term, categories]) => [term.toLowerCase(), categories]),
        ),
        overrides,
        limitsFor: buildLimitsFor(shipped, view),
        isDigitsAllowed: shipped.allow_digits,
        isRepeatAllowed: shipped.allow_repeated_words,
    };
}

/**
 * Splits a name into lowercase parts: `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.
 * @param name the identifier.
 * @returns the lowercase words and digit groups.
 */
export function splitParts(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((part) => (NUMERIC_WORDS.has(part.toLowerCase()) ? [part] : part.split(DIGIT_BOUNDARY)))
        .map((part) => part.toLowerCase())
        .filter((part) => part !== '');
}
