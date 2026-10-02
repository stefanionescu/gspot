import { compact } from '#cli/platform/text.ts';
import type { Manifest } from '#cli/types/kits.ts';
import { shippedPolicy } from '#cli/policy/audit.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { compileTerms } from '#cli/checks/general/naming/match.ts';
import { policyTables, settingValue } from '#cli/policy/settings.ts';
import { CATEGORY_PARENTS } from '#cli/config/checks/general/naming.ts';
import type { PathRule, Identifier, CategoryLimits, EffectivePolicy } from '#cli/types/checks/general/naming.ts';

import type {
    Policy,
    ShippedRule,
    ShippedPolicy,
    NamingSettings,
    SettingSurface,
    ShippedLanguage,
} from '#cli/types/policy/policy.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three rule lists treat an empty list as no filter.
function toSet(names: string[] | undefined): Set<string> | undefined {
    return names === undefined || names.length === 0 ? undefined : new Set(names);
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Shipped and written naming rules compile to one matcher shape.
function compileRule(rule: ShippedRule, source: string): PathRule {
    return {
        isPath: pathMatcher(rule.paths),
        languages: toSet(rule.languages),
        categories: toSet(rule.categories),
        names: toSet(rule.names),
        isExcluding: rule.exclude === true,
        isDigitsAllowed: rule.allow_digits === true,
        isDuplicatesAllowed: rule.allow_duplicate_words === true,
        structuralPrefix: rule.structural_prefix === undefined ? undefined : new RegExp(rule.structural_prefix, 'u'),
        caseNames: rule.case,
        source,
    };
}

function reservedTerms(shipped: ShippedPolicy, naming: NamingSettings): Map<string, string[]> {
    const reserved = new Map<string, string[]>();
    for (const entry of [...shipped.reserved, ...naming.reserved]) reserved.set(entry.term.toLowerCase(), entry.uses);
    return reserved;
}

function limitsReader(
    shipped: ShippedPolicy,
    surface: SettingSurface,
    policy: Policy,
    scope: string,
): EffectivePolicy['limitsFor'] {
    return (language, category) => {
        const table: ShippedLanguage | undefined = shipped.languages[language];
        const parent = CATEGORY_PARENTS[category] ?? category;
        const prefix = `naming.${language}`;

        const ceiling = (slot: string, defaultLimit: number | undefined): number => {
            const found = [`${prefix}.${parent}.${slot}`, `${prefix}.${slot}`]
                .map((key) => settingValue(surface, policy, key, scope)?.value)
                .find((value): value is number => typeof value === 'number');
            return found ?? defaultLimit ?? 0;
        };
        const cases = settingValue(surface, policy, `${prefix}.${parent}.case`, scope)?.value;
        return {
            caseNames: Array.isArray(cases) ? (cases as string[]) : shippedCase(table, category, parent),
            maxChars: ceiling('max_chars', table?.max_chars),
            maxWords: ceiling('max_words', table?.max_words),
        };
    };
}

function shippedCase(table: ShippedLanguage | undefined, category: string, parent: string): string[] {
    if (table === undefined) return [];
    return table.categories[category]?.case ?? table.categories[parent]?.case ?? [];
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
    surface: SettingSurface,
    policy: Policy,
    scope: string,
    manifests: Pick<Manifest, 'kit' | 'naming'>[] = [],
): EffectivePolicy {
    const shipped = shippedPolicy();
    const tables = policyTables(policy, scope).map(({ table }) => table.naming);
    const naming: NamingSettings = {
        ...policy.naming,
        banned: [...new Set(tables.flatMap((table) => table?.banned ?? []))],
        allowed: tables.flatMap((table) => table?.allowed ?? []),
        external: [...new Set(tables.flatMap((table) => table?.external ?? []))],
        reserved: tables.flatMap((table) => table?.reserved ?? []),
        dropped_groups: tables.flatMap((table) => table?.dropped_groups ?? []),
        protocol_keys: tables.flatMap((table) => table?.protocol_keys ?? []),
        rules: tables.flatMap((table) => table?.rules ?? []),
    };
    const removed = new Set(
        naming.dropped_groups.map((entry) => entry.group).filter((group) => shipped.groups[group]?.removable === true),
    );
    const terms = [
        ...Object.entries(shipped.groups)
            .filter(([group]) => !removed.has(group))
            .flatMap(([group, { terms }]) => compileTerms(terms, `${group} group`)),
        ...compileTerms(naming.banned, 'naming.banned'),
    ];
    // The shipped rules first, then what the selected kits know about their own files, then the repository's.
    const rules = [
        ...shipped.rules.map((rule, index) => compileRule(rule, `shipped rule ${String(index + 1)}`)),
        ...manifests.flatMap((manifest) =>
            (manifest.naming?.rules ?? []).map((rule) =>
                compileRule(compact(rule), `the ${manifest.kit.name} configuration`),
            ),
        ),
        ...naming.rules.map((rule, index) => compileRule(rule, `[[naming.rules]] entry ${String(index + 1)}`)),
    ];
    return {
        terms,
        reserved: reservedTerms(shipped, naming),
        external: new Set([...shipped.external, ...naming.external]),
        allowed: new Map(naming.allowed.map((entry) => [entry.name, entry.reason])),
        contractProperties: new Map(naming.protocol_keys.map((entry) => [entry.file, new Set(entry.names)])),
        rules,
        languages: shipped.languages,
        limitsFor: limitsReader(shipped, surface, policy, scope),
        isDigitsBanned: shipped.ban_digits,
        isDuplicatesBanned: shipped.ban_repeats,
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
