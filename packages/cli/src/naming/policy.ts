import { CATEGORY_PARENTS } from '#config/cases.ts';
import { compileTerms } from '#cli/naming/match.ts';
// The shipped policy plus [naming] in gspot.toml: terms, exemptions, rules and the per-language ceilings and cases.
import { readAsset } from '#cli/platform/assets.ts';
import { pathMatcher } from '#cli/presets/claims.ts';
import { settingValue } from '#cli/policy/settings.ts';
import type { NamingSettings, NamingRule, Policy, SettingsSurface } from '#types/config.ts';

import type {
    CategoryLimits,
    EffectivePolicy,
    Identifier,
    PathRule,
    ShippedLanguage,
    ShippedPolicy,
    ShippedRule,
    Term,
} from '#types/naming.ts';

const POLICY_ASSET = 'presets/naming/policy.json';
const NEVER_REMOVED = new Set(['marketing', 'defensive']);
const state: { shipped: ShippedPolicy | undefined } = { shipped: undefined };

function toSet(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

function compileRule(rule: ShippedRule, source: string): PathRule {
    return {
        isPath: pathMatcher(rule.paths),
        languages: toSet(rule.languages),
        categories: toSet(rule.categories),
        names: toSet(rule.names),
        isExcluding: rule.exclude === true,
        isDigitsAllowed: rule.allowDigits === true,
        isDuplicatesAllowed: rule.allowDuplicateWords === true,
        structuralPrefix: rule.structuralPrefix === undefined ? undefined : new RegExp(rule.structuralPrefix, 'u'),
        caseNames: rule.case,
        source,
    };
}

function writtenRule(rule: NamingRule, index: number): PathRule {
    const shaped: ShippedRule = {
        paths: rule.paths,
        languages: rule.languages,
        categories: rule.categories,
        names: rule.names,
        exclude: rule.exclude,
        allowDigits: rule.allow_digits,
        allowDuplicateWords: rule.allow_duplicate_words,
        structuralPrefix: rule.structural_prefix,
        case: rule.case,
    };
    return compileRule(shaped, `[[naming.rules]] entry ${String(index + 1)}`);
}

function groupTerms(shipped: ShippedPolicy, naming: NamingSettings): Term[] {
    const removed = new Set(
        naming.remove_groups.map((entry) => entry.group).filter((group) => !NEVER_REMOVED.has(group)),
    );
    return Object.entries(shipped.groups)
        .filter(([group]) => !removed.has(group))
        .flatMap(([group, { terms }]) => compileTerms(terms, `${group} group`));
}

function reservedTerms(shipped: ShippedPolicy, naming: NamingSettings): Map<string, string[]> {
    const reserved = new Map<string, string[]>();
    for (const entry of shipped.reserved) reserved.set(entry.term.toLowerCase(), entry.allowedFor);
    for (const entry of naming.reserved) reserved.set(entry.term.toLowerCase(), entry.allowed_for);
    return reserved;
}

function numberSetting(surface: SettingsSurface, policy: Policy, scope: string, key: string): number | undefined {
    const found = settingValue(surface, policy, key, scope);
    return typeof found?.value === 'number' ? found.value : undefined;
}

function listSetting(surface: SettingsSurface, policy: Policy, scope: string, key: string): string[] | undefined {
    const found = settingValue(surface, policy, key, scope);
    return Array.isArray(found?.value) ? (found.value as string[]) : undefined;
}

function readerOf(
    surface: SettingsSurface,
    policy: Policy,
    scope: string,
): { number: (key: string) => number | undefined; list: (key: string) => string[] | undefined } {
    return {
        number: (key) => numberSetting(surface, policy, scope, key),
        list: (key) => listSetting(surface, policy, scope, key),
    };
}

function ceilingFor(
    read: ReturnType<typeof readerOf>,
    prefix: string,
    parent: string,
    slot: string,
    shipped: number | undefined,
): number {
    return read.number(`${prefix}.${parent}.${slot}`) ?? read.number(`${prefix}.${slot}`) ?? shipped ?? 0;
}

function limitsReader(
    shipped: ShippedPolicy,
    surface: SettingsSurface,
    policy: Policy,
    scope: string,
): EffectivePolicy['limitsFor'] {
    const read = readerOf(surface, policy, scope);
    return (language, category) => {
        const table: ShippedLanguage | undefined = shipped.languages[language];
        const parent = CATEGORY_PARENTS[category] ?? category;
        const prefix = `naming.${language}`;
        return {
            caseNames: read.list(`${prefix}.${parent}.case`) ?? shippedCase(table, category, parent),
            maxChars: ceilingFor(read, prefix, parent, 'max_chars', table?.maxChars),
            maxWords: ceilingFor(read, prefix, parent, 'max_words', table?.maxWords),
        };
    };
}

function shippedCase(table: ShippedLanguage | undefined, category: string, parent: string): string[] {
    if (table === undefined) return [];
    return table.categories[category]?.case ?? table.categories[parent]?.case ?? [];
}

/**
 * The shipped policy, read once.
 * @returns the parsed presets/naming/policy.json
 */
export function shippedPolicy(): ShippedPolicy {
    state.shipped ??= JSON.parse(readAsset(POLICY_ASSET)) as ShippedPolicy;
    return state.shipped;
}

/**
 * The policy in force for a scope: the shipped lists with the repository's additions, exemptions and ceilings.
 * @param surface the scope's settings surface
 * @param policy the repository policy
 * @param scope the scope path, '' for the root
 * @returns the effective policy
 */
export function effectivePolicy(surface: SettingsSurface, policy: Policy, scope: string): EffectivePolicy {
    const shipped = shippedPolicy();
    const naming = { ...policy.naming, ...policy.scopeTables[scope]?.naming };
    const terms = [...groupTerms(shipped, naming), ...compileTerms(naming.banned_terms, 'naming.banned_terms')];
    const rules = [
        ...shipped.rules.map((rule, index) => compileRule(rule, `shipped rule ${String(index + 1)}`)),
        ...naming.rules.map((rule, index) => writtenRule(rule, index)),
    ];
    return {
        terms,
        reserved: reservedTerms(shipped, naming),
        external: new Set([...shipped.external, ...naming.external]),
        allowed: new Map(naming.allowed.map((entry) => [entry.name, entry.reason])),
        contractProperties: new Map(naming.contract_properties.map((entry) => [entry.file, new Set(entry.names)])),
        rules,
        languages: shipped.languages,
        limitsFor: limitsReader(shipped, surface, policy, scope),
        isDigitsBanned: shipped.banDigits,
        isDuplicatesBanned: shipped.banDuplicateWords,
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
            rule.isPath(path) &&
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
export function limitsUnderRules(policy: EffectivePolicy, identifier: Identifier, rules: PathRule[]): CategoryLimits {
    const base = policy.limitsFor(identifier.language, identifier.category);
    const caseRule = rules.findLast((rule) => rule.caseNames !== undefined);
    return caseRule?.caseNames === undefined ? base : { ...base, caseNames: caseRule.caseNames };
}
