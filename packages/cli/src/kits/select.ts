import { similar } from '#cli/policy/similar.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import type { Manifest, SelectionWalk } from '#cli/types/kits.ts';
// Selection: the configurations named plus every kit they require, dependencies first, in order of first mention.

function visit(walk: SelectionWalk, kitName: string): void {
    if (walk.seen.has(kitName)) return;
    if (walk.visiting.includes(kitName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(kitName)), kitName];
        walk.problems.push(messages.circularRequires(chain));
        return;
    }
    const manifest = walk.manifests.get(kitName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.problems.push(messages.unknownKit(kitName, similar(kitName, known)));
        walk.seen.add(kitName);
        return;
    }
    walk.visiting.push(kitName);
    for (const required of manifest.kit.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(kitName);
    walk.order.push(manifest);
}

function chainFrom(
    target: string,
    from: string,
    manifests: Map<string, Manifest>,
    seen: Set<string>,
): string[] | undefined {
    if (from === target) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    const requires = manifests.get(from)?.kit.requires ?? [];
    for (const required of requires) {
        const rest = chainFrom(target, required, manifests, seen);
        if (rest) return [from, ...rest];
    }
    return undefined;
}

/** Every problem a selection has, as one error with one line per problem. */
export class SelectionError extends Error {
    readonly problems: string[];

    /**
     * Joins the problems into the message and keeps them as a list.
     * @param problems the problems in plain English
     */
    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'SelectionError';
        this.problems = problems;
    }
}

/**
 * The chain of requires from one kit to another, or undefined when the first does not need the second.
 * @param target the configuration that is required
 * @param from the configuration the chain starts at
 * @param manifests every kit manifest
 * @returns the configuration names from `from` to `target`
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The chain of requires from one kit to another, or undefined when the first does not need the second. 2 files make 2 calls; one owner keeps that behavior in one place.
export function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    return chainFrom(target, from, manifests, new Set());
}

/**
 * Resolves configuration names to ordered manifests. Throws SelectionError for unknown kits or circular requirements.
 * @param kitNames the requested configuration names
 * @param manifests every kit manifest
 * @returns the manifests, requirements first, in order of first mention
 */
export function selectKits(kitNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, problems: [], order: [], seen: new Set(), visiting: [] };
    for (const kitName of kitNames) visit(walk, kitName);
    const { problems } = walk;
    if (problems.length > 0) throw new SelectionError([...new Set(problems)]);
    return walk.order;
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param policy the declared selections
 * @param scope the scope path
 * @param manifests every kit manifest
 * @returns the manifests in order
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The root selection and each ancestor scope selection, deduplicated in order. 3 files make 5 calls; one owner keeps that behavior in one place.
export function selectForScope(
    policy: Pick<Policy, 'kits' | 'scopes'>,
    scope: string,
    manifests: Map<string, Manifest>,
): Manifest[] {
    return selectKits(
        [...policy.kits, ...scopeAncestors(policy.scopes, scope).flatMap((entry) => entry.kits)],
        manifests,
    );
}

/**
 * The language kits in a selection.
 * @param selected the selected manifests
 * @returns the manifests whose kind is language
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The language kits in a selection. 1 files make 2 calls; one owner keeps that behavior in one place.
export function languageKits(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.kit.kind === 'language');
}

/**
 * Language and framework kits that contribute source to shared checks.
 * @param selected the selected manifests
 * @returns the source policy owners
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Language and framework kits that contribute source to shared checks. 2 files make 3 calls; one owner keeps that behavior in one place.
export function sourceKits(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.kit.kind === 'language' || manifest.kit.kind === 'framework');
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param scopes the selected scopes
 * @returns the manifests
 */
export function everyManifest(scopes: { selected: Manifest[] }[]): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of scopes)
        for (const manifest of scope.selected) if (!seen.has(manifest.kit.name)) seen.set(manifest.kit.name, manifest);
    return seen.values().toArray();
}
