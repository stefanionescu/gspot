import { splitByCase } from 'scule';
import { stripUndefined } from '#cli/system/values.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { ScopeView } from '#cli/types/settings/values.ts';
import { listApplicableTables } from '#cli/settings/inherit.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { readNamingDefaults } from '#cli/configurations/manifests.ts';
import { SETTING_LANGUAGES, NAMING_TABLE_CATEGORIES } from '#cli/config/settings/schema.ts';
import { SEPARATORS, NUMERIC_WORDS, DIGIT_BOUNDARY, CATEGORY_PARENTS } from '#cli/config/checks/general/naming.ts';

import type {
    Term,
    NamingDefaults,
    NamingLanguage,
    NamingOverride,
    NamingSettings,
    CompiledOverride,
} from '#cli/types/checks/general.ts';

function toSet(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

function compileOverride(rule: NamingOverride, source: string): CompiledOverride {
    return {
        matches: buildPathMatcher(rule.paths ?? ['**']),
        languages: toSet(rule.languages),
        categories: toSet(rule.categories),
        allowed: toSet(rule.allowed_names),
        isDigitsAllowed: rule.allow_digits === true,
        isRepeatAllowed: rule.allow_repeated_words === true,
        structuralPrefix: rule.ignored_prefix === undefined ? undefined : new RegExp(rule.ignored_prefix, 'u'),
        caseNames: rule.cases,
        source,
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
    const table: NamingLanguage | undefined = shipped.languages[language];
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
 * Compiles a term list into parts.
 * @param terms the terms as written.
 * @param origin the display source and stable group, when the terms belong to a group.
 * @returns the compiled terms, empty ones dropped.
 */
function compileTerms(terms: string[], origin: Pick<Term, 'source' | 'group' | 'categories'>): Term[] {
    return terms
        .map((term) => ({ term: term.trim().toLowerCase(), parts: splitParts(term), ...origin }))
        .filter((term) => term.parts.length > 0);
}

/**
 * The settings in force for a scope: the shipped lists with the repository's additions, exemptions, and limits.
 * @param input the effective selection, written settings, and run's source reads.
 * @returns the effective settings.
 */
function readNamingSettings(
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
            compileTerms(terms, {
                source: `${group} group`,
                group,
                ...(group === 'folders' ? { categories: ['directories'] } : {}),
            }),
        ),
        ...compileTerms(bannedWords, { source: 'naming.banned_words' }),
    ];
    // The shipped rules first, then what the selected configurations know about their own files, then the repository's.
    const rules = [
        compileOverride({ allowed_names: shipped.allowed_names }, 'shipped allowed names'),
        ...shipped.override.map((rule, index) => compileOverride(rule, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.override ?? []).map((rule) =>
                compileOverride(stripUndefined(rule), `the ${manifest.configuration.name} configuration`),
            ),
        ),
        ...settings.naming.override.map((rule, index) =>
            compileOverride(rule, `[[naming.override]] entry ${String(index + 1)}`),
        ),
    ];
    return {
        terms,
        reserved: new Map(
            Object.entries(shipped.reserved).map(([term, categories]) => [term.toLowerCase(), categories]),
        ),
        rules,
        limitsFor: buildLimitsFor(shipped, view),
        isDigitsAllowed: shipped.allow_digits,
        isRepeatAllowed: shipped.allow_repeated_words,
    };
}

/**
 * The parts of an identifier, lowercased. `HTMLParser` gives `html`, `parser`; `user_id` gives `user`, `id`; `v2` gives `v`, `2`; `base64` stays one word.
 * @param name the identifier.
 * @returns the parts.
 */
function splitParts(name: string): string[] {
    return name
        .split(SEPARATORS)
        .filter((segment) => segment !== '')
        .flatMap((segment) => splitByCase(segment))
        .flatMap((part) => (NUMERIC_WORDS.has(part.toLowerCase()) ? [part] : part.split(DIGIT_BOUNDARY)))
        .map((part) => part.toLowerCase())
        .filter((part) => part !== '');
}

export { splitParts, readNamingSettings };
