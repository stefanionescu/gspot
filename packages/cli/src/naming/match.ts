// Whole-part matching of banned terms, reserved terms, external names and contract properties.
import { splitParts } from '#cli/naming/split.ts';
import type { Identifier } from '#cli/naming/extract.ts';
import type { EffectivePolicy, Term } from '#cli/naming/policy.ts';

const RESERVED_USES: Record<string, string[]> = {
    directory: ['directories', 'packages'],
    'file stem': ['files', 'modules'],
    variable: ['variables', 'constants', 'parameters'],
    property: ['properties', 'attributes', 'enum_cases'],
    field: ['properties', 'attributes'],
    'identifier word': ['*'],
};

function isConsecutive(parts: string[], termParts: string[]): boolean {
    if (termParts.length > parts.length) return false;
    for (let start = 0; start + termParts.length <= parts.length; start += 1) {
        if (termParts.every((part, index) => parts[start + index] === part)) return true;
    }
    return false;
}

function categoriesFor(allowedFor: string): string[] {
    const found = Object.entries(RESERVED_USES).find(([use]) => allowedFor.endsWith(use));
    return found?.[1] ?? [];
}

/**
 * Compiles a term list into parts.
 * @param terms the terms as written
 * @param source where they came from, for the finding
 * @returns the compiled terms, empty ones dropped
 */
export function compileTerms(terms: string[], source: string): Term[] {
    return terms
        .map((term) => ({ term: term.trim().toLowerCase(), parts: splitParts(term), source }))
        .filter((term) => term.parts.length > 0);
}

/**
 * The first banned term the parts carry: a one-word term equals a part, a longer one matches consecutive parts.
 * @param parts the identifier's parts
 * @param terms the compiled terms
 * @returns the term, or undefined
 */
export function bannedTerm(parts: string[], terms: Term[]): Term | undefined {
    return terms.find((term) =>
        term.parts.length === 1 ? parts.includes(term.parts[0]!) : isConsecutive(parts, term.parts),
    );
}

/**
 * True when a reserved term is allowed for an identifier's category.
 * @param allowedFor the uses the policy allows the term for
 * @param category the identifier's category
 * @returns whether the use is named
 */
export function isReservedUseAllowed(allowedFor: string[], category: string): boolean {
    return allowedFor.some((use) => {
        const categories = categoriesFor(use);
        return categories.includes('*') || categories.includes(category);
    });
}

/**
 * True when the whole identifier is exempt: an external name, an allowed name, or a contract property in its file.
 * @param policy the effective policy
 * @param identifier the identifier
 * @returns whether no naming check applies
 */
export function isExempt(policy: EffectivePolicy, identifier: Identifier): boolean {
    if (policy.external.has(identifier.name) || policy.allowed.has(identifier.name)) return true;
    return policy.contractProperties.get(identifier.file)?.has(identifier.name) ?? false;
}
