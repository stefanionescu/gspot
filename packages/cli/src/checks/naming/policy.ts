import { compact } from '#cli/policy/normalize.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { pathMatcher } from '#cli/repository/paths.ts';
import { compileTerms } from '#cli/checks/naming/match.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { settingValue, policyTables } from '#cli/policy/settings.ts';
import { POLICY_ASSET, CATEGORY_PARENTS } from '#cli/constants/checks/naming.ts';
import type { ExposedSettings, NamingRule, NamingSettings, Policy } from '#cli/types/policy/policy.ts';

import type {
    Identifier,
    CategoryLimits,
    EffectivePolicy,
    PathRule,
    ShippedLanguage,
    ShippedPolicy,
    ShippedRule,
    Term,
} from '#cli/types/checks/naming.ts';

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

function writtenRule(rule: NamingRule, source: string): PathRule {
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
    return compileRule(shaped, source);
}

function groupTerms(shipped: ShippedPolicy, naming: NamingSettings): Term[] {
    const removed = new Set(
        naming.remove_groups.map((entry) => entry.group).filter((group) => shipped.groups[group]?.removable === true),
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

function numberSetting(surface: ExposedSettings, policy: Policy, scope: string, key: string): number | undefined {
    const found = settingValue(surface, policy, key, scope);
    return typeof found?.value === 'number' ? found.value : undefined;
}

function listSetting(surface: ExposedSettings, policy: Policy, scope: string, key: string): string[] | undefined {
    const found = settingValue(surface, policy, key, scope);
    return Array.isArray(found?.value) ? (found.value as string[]) : undefined;
}

function limitsReader(
    shipped: ShippedPolicy,
    surface: ExposedSettings,
    policy: Policy,
    scope: string,
): EffectivePolicy['limitsFor'] {
    return (language, category) => {
        const table: ShippedLanguage | undefined = shipped.languages[language];
        const parent = CATEGORY_PARENTS[category] ?? category;
        const prefix = `naming.${language}`;
        const ceiling = (slot: string, fallback: number | undefined): number =>
            numberSetting(surface, policy, scope, `${prefix}.${parent}.${slot}`) ??
            numberSetting(surface, policy, scope, `${prefix}.${slot}`) ??
            fallback ??
            0;
        return {
            caseNames:
                listSetting(surface, policy, scope, `${prefix}.${parent}.case`) ?? shippedCase(table, category, parent),
            maxChars: ceiling('max_chars', table?.maxChars),
            maxWords: ceiling('max_words', table?.maxWords),
        };
    };
}

function shippedCase(table: ShippedLanguage | undefined, category: string, parent: string): string[] {
    if (table === undefined) return [];
    return table.categories[category]?.case ?? table.categories[parent]?.case ?? [];
}

/**
 * The shipped policy, read once.
 * @returns the parsed packages/cli/configurations/policy/naming/policy.json
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
 * @param manifests the selected manifests, whose naming rules follow the shipped ones
 * @returns the effective policy
 */
export function effectivePolicy(
    surface: ExposedSettings,
    policy: Policy,
    scope: string,
    manifests: Pick<Manifest, 'configuration' | 'naming'>[] = [],
): EffectivePolicy {
    const shipped = shippedPolicy();
    const tables = policyTables(policy, scope).map(({ table }) => table.naming);
    const naming: NamingSettings = {
        ...policy.naming,
        banned_terms: [...new Set(tables.flatMap((table) => table?.banned_terms ?? []))],
        allowed: tables.flatMap((table) => table?.allowed ?? []),
        external: [...new Set(tables.flatMap((table) => table?.external ?? []))],
        reserved: tables.flatMap((table) => table?.reserved ?? []),
        remove_groups: tables.flatMap((table) => table?.remove_groups ?? []),
        contract_properties: tables.flatMap((table) => table?.contract_properties ?? []),
        rules: tables.flatMap((table) => table?.rules ?? []),
    };
    const terms = [...groupTerms(shipped, naming), ...compileTerms(naming.banned_terms, 'naming.banned_terms')];
    // The shipped rules first, then what the selected configurations know about their own files, then the repository's.
    const rules = [
        ...shipped.rules.map((rule, index) => compileRule(rule, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.rules ?? []).map((rule) =>
                writtenRule(compact(rule), `the ${manifest.configuration.name} configuration`),
            ),
        ),
        ...naming.rules.map((rule, index) => writtenRule(rule, `[[naming.rules]] entry ${String(index + 1)}`)),
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
