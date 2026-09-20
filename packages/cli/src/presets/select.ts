// Selection: the presets named plus every preset they require, dependencies first, in order of first mention.
import type { Session } from '#types/run.ts';
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Manifest, SelectionWalk } from '#types/manifest.ts';

function visit(walk: SelectionWalk, presetName: string): void {
    if (walk.seen.has(presetName)) return;
    if (walk.visiting.includes(presetName)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(presetName)), presetName];
        walk.problems.push(messages.circularRequires(chain));
        return;
    }
    const manifest = walk.manifests.get(presetName);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.problems.push(messages.unknownPreset(presetName, nearMatches(presetName, known)));
        walk.seen.add(presetName);
        return;
    }
    walk.visiting.push(presetName);
    for (const required of manifest.preset.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(presetName);
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
    const requires = manifests.get(from)?.preset.requires ?? [];
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
 * The chain of requires from one preset to another, or undefined when the first does not need the second.
 * @param target the preset that is required
 * @param from the preset the chain starts at
 * @param manifests every preset manifest
 * @returns the preset names from `from` to `target`
 */
export function requireChain(target: string, from: string, manifests: Map<string, Manifest>): string[] | undefined {
    return chainFrom(target, from, manifests, new Set());
}

/**
 * Resolves preset names to ordered manifests. Throws SelectionError for unknown presets or circular requirements.
 * @param presetNames the requested preset names
 * @param manifests every preset manifest
 * @returns the manifests, requirements first, in order of first mention
 */
export function selectPresets(presetNames: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, problems: [], order: [], seen: new Set(), visiting: [] };
    for (const presetName of presetNames) visit(walk, presetName);
    const { problems } = walk;
    if (problems.length > 0) throw new SelectionError([...new Set(problems)]);
    return walk.order;
}

/**
 * The selection for one scope: the root selection plus the scope's own, deduplicated in order.
 * @param rootNames the root preset names
 * @param scopeNames the scope's preset names
 * @param manifests every preset manifest
 * @returns the manifests in order
 */
export function selectForScope(
    rootNames: string[],
    scopeNames: string[],
    manifests: Map<string, Manifest>,
): Manifest[] {
    return selectPresets([...rootNames, ...scopeNames], manifests);
}

/**
 * The language presets in a selection.
 * @param selected the selected manifests
 * @returns the manifests whose kind is language
 */
export function languagePresets(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.preset.kind === 'language');
}

/**
 * Language and framework presets that contribute source to shared checks.
 * @param selected the selected manifests
 * @returns the source policy owners
 */
export function sourcePresets(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.preset.kind === 'language' || manifest.preset.kind === 'framework');
}

/**
 * Every distinct manifest across the scopes, in first-seen order.
 * @param session the session
 * @returns the manifests
 */
export function everyManifest(session: Session): Manifest[] {
    const seen = new Map<string, Manifest>();
    for (const scope of session.scopes)
        for (const manifest of scope.selected)
            if (!seen.has(manifest.preset.name)) seen.set(manifest.preset.name, manifest);
    return seen.values().toArray();
}
