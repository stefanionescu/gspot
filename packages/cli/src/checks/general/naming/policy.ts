import { compact } from '#cli/platform/objects.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { namingTerms } from '#cli/configurations/manifests.ts';
import { splitParts } from '#cli/checks/general/naming/words.ts';
import { CATEGORY_PARENTS } from '#cli/config/checks/general/naming.ts';
import { tablesFor, settingValue } from '#cli/policy/settings/lookup.ts';
import type { Policy, KnownSettings, NamingSettings } from '#cli/types/policy/settings.ts';
import type { Term, PathRule, CategoryLimits, EffectivePolicy } from '#cli/types/checks/general/naming.ts';
import type { Identifier, NamingTerms, NamingLanguage, NamingOverride } from '#cli/types/parsers/naming.ts';

function toSet(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

function compileRule(rule: NamingOverride, source: string): PathRule {
    return {
        matches: pathMatcher(rule.paths),
        languages: toSet(rule.languages),
        categories: toSet(rule.categories),
        names: toSet(rule.names),
        allowed: toSet(rule.allowed),
        isDigitsAllowed: rule.allow_digits === true,
        isRepeatAllowed: rule.allow_repeated_words === true,
        structuralPrefix: rule.ignored_prefix === undefined ? undefined : new RegExp(rule.ignored_prefix, 'u'),
        caseNames: rule.case,
        source,
    };
}

function reservedTerms(shipped: NamingTerms, naming: NamingSettings): Map<string, string[]> {
    const reserved = new Map<string, string[]>();
    for (const [term, categories] of Object.entries({ ...shipped.reserved, ...naming.reserved }))
        reserved.set(term.toLowerCase(), categories);
    return reserved;
}

function buildLimitsFor(
    shipped: NamingTerms,
    surface: KnownSettings,
    policy: Policy,
    scope: string,
): EffectivePolicy['limitsFor'] {
    return (language, category) => {
        const table: NamingLanguage | undefined = shipped.languages[language];
        const parent = CATEGORY_PARENTS[category] ?? category;
        const prefix = `naming.${language}`;

        const ceiling = (slot: string): number => {
            const found = [`${prefix}.${parent}.${slot}`, `${prefix}.${slot}`]
                .map((key) => settingValue(surface, policy, key, scope)?.value)
                .find((value): value is number => typeof value === 'number');
            return found ?? 0;
        };
        const cases = settingValue(surface, policy, `${prefix}.${parent}.case`, scope)?.value;
        const defaults =
            [category, parent].map((name) => table?.categories[name]?.case).find((names) => names !== undefined) ?? [];
        return {
            caseNames: Array.isArray(cases) && cases.length > 0 ? (cases as string[]) : defaults,
            maxChars: ceiling('max_chars'),
            maxWords: ceiling('max_words'),
        };
    };
}

/**
 * Compiles a term list into parts.
 * @param terms the terms as written
 * @param origin the display source and stable group, when the terms belong to a group
 * @returns the compiled terms, empty ones dropped
 */
export function compileTerms(terms: string[], origin: Pick<Term, 'source' | 'group'>): Term[] {
    return terms
        .map((term) => ({ term: term.trim().toLowerCase(), parts: splitParts(term), ...origin }))
        .filter((term) => term.parts.length > 0);
}

/**
 * The policy in force for a scope: the shipped lists with the repository's additions, exemptions, and ceilings.
 * @param surface the scope's settings surface
 * @param policy the repository policy
 * @param scope the scope path, '' for the root
 * @param manifests the selected manifests, whose naming rules follow the shipped ones
 * @returns the effective policy
 */
export function effectivePolicy(
    surface: KnownSettings,
    policy: Policy,
    scope: string,
    manifests: Pick<Manifest, 'configuration' | 'naming'>[],
): EffectivePolicy {
    const shipped = namingTerms();
    const tables = tablesFor(policy, scope).map(({ table }) => table.naming);
    const naming: NamingSettings = {
        ...policy.naming,
        banned: [...new Set(tables.flatMap((table) => table?.banned ?? []))],
        allowed: Object.fromEntries(
            tables.flatMap((table) => (table === undefined ? [] : Object.entries(table.allowed))),
        ),
        reserved: Object.fromEntries(
            tables.flatMap((table) => (table === undefined ? [] : Object.entries(table.reserved))),
        ),
        overrides: tables.flatMap((table) => table?.overrides ?? []),
    };
    const terms = [
        ...Object.entries(shipped.groups).flatMap(([group, { terms }]) =>
            compileTerms(terms, { source: `${group} group`, group }),
        ),
        ...compileTerms(naming.banned, { source: 'naming.banned' }),
    ];
    // The shipped rules first, then what the selected configurations know about their own files, then the repository's.
    const rules = [
        ...shipped.overrides.map((rule, index) => compileRule(rule, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.overrides ?? []).map((rule) =>
                compileRule(compact(rule), `the ${manifest.configuration.name} configuration`),
            ),
        ),
        ...naming.overrides.map((rule, index) => compileRule(rule, `[[naming.overrides]] entry ${String(index + 1)}`)),
    ];
    return {
        terms,
        reserved: reservedTerms(shipped, naming),
        allowed: new Map([
            ...shipped.allowed.map((name) => [name, undefined] as const),
            ...Object.entries(naming.allowed),
        ]),
        rules,
        limitsFor: buildLimitsFor(shipped, surface, policy, scope),
        isDigitsAllowed: shipped.allow_digits,
        isRepeatAllowed: shipped.allow_repeated_words,
    };
}

/**
 * The path rules that apply to one identifier.
 * @param policy the effective policy
 * @param identifier the identifier
 * @returns the rules, in policy order
 */
export function rulesFor(policy: EffectivePolicy, identifier: Identifier): PathRule[] {
    const path = identifier.directory ?? identifier.file;
    return policy.rules.filter(
        (rule) =>
            rule.matches(path) &&
            (rule.languages === undefined || rule.languages.has(identifier.language)) &&
            (rule.categories === undefined || rule.categories.has(identifier.category)) &&
            (rule.names === undefined || rule.names.has(identifier.name)),
    );
}

/**
 * The ceilings and cases for one identifier after its path rules.
 * @param policy the effective policy
 * @param identifier the identifier
 * @param rules the rules that apply
 * @returns the limits
 */
export function ruleLimits(policy: EffectivePolicy, identifier: Identifier, rules: PathRule[]): CategoryLimits {
    const base = policy.limitsFor(identifier.language, identifier.category);
    const parent = CATEGORY_PARENTS[identifier.category] ?? identifier.category;
    if (
        (identifier.language === 'swift' && ['types', 'variables'].includes(parent)) ||
        (identifier.language === 'python' && ['classes', 'exceptions'].includes(identifier.category))
    )
        return { ...base, caseNames: [], maxChars: 0 };
    const caseRule = rules.findLast((rule) => rule.caseNames !== undefined);
    return caseRule?.caseNames === undefined ? base : { ...base, caseNames: caseRule.caseNames };
}
