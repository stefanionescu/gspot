import { similar } from '#cli/platform/text.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { scopeAncestors } from '#cli/repository/scopes.ts';
import { unknownKit, circularRequires } from '#cli/kits/messages.ts';
import type { Manifest, PolicyScope, SelectionWalk } from '#cli/types/kits.ts';
// Selection: the configurations named plus every kit they require, dependencies first, in order of first mention.

function visit(walk: SelectionWalk, kitName: string): void {
    if (walk.seen.has(kitName)) return;
    if (walk.visiting.includes(kitName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(kitName)), kitName];
        walk.problems.push(circularRequires(chain));
        return;
    }
    const manifest = walk.manifests.get(kitName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.problems.push(unknownKit(kitName, similar(kitName, known)));
        walk.seen.add(kitName);
        return;
    }
    walk.visiting.push(kitName);
    for (const required of manifest.kit.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(kitName);
    walk.order.push(manifest);
}

/**
 * The chain of requires from one kit to another, or undefined when the first does not need the second.
 * @param target the configuration that is required
 * @param from the configuration the chain starts at
 * @param manifests every kit manifest
 * @param seen the kits the search has visited, which it fills
 * @returns the configuration names from `from` to `target`
 */
export function requireChain(
    target: string,
    from: string,
    manifests: Map<string, Manifest>,
    seen = new Set<string>(),
): string[] | undefined {
    if (from === target) return [from];
    if (seen.has(from)) return undefined;
    seen.add(from);
    const requires = manifests.get(from)?.kit.requires ?? [];
    for (const required of requires) {
        const rest = requireChain(target, required, manifests, seen);
        if (rest) return [from, ...rest];
    }
    return undefined;
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
    if (problems.length > 0) throw new GspotError('selection', [...new Set(problems)]);
    return walk.order;
}

/**
 * The root selection and each ancestor scope selection, deduplicated in order.
 * @param policy the declared selections
 * @param policy.kits the kits the root selects
 * @param policy.scopes the scopes, each with the kits it selects
 * @param scope the scope path
 * @param manifests every kit manifest
 * @returns the manifests in order
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The session, validation, and naming inherit the kits of a scope by one rule.
export function selectForScope(
    policy: { kits: string[]; scopes: PolicyScope[] },
    scope: string,
    manifests: Map<string, Manifest>,
): Manifest[] {
    return selectKits(
        [...policy.kits, ...scopeAncestors(policy.scopes, scope).flatMap((entry) => entry.kits)],
        manifests,
    );
}

/**
 * Language and framework kits that contribute source to shared checks.
 * @param selected the selected manifests
 * @returns the source policy owners
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Kit files and the single-file-folder check count the same kits as source.
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
