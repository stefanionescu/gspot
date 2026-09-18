// Selection: the presets named plus every preset they require, dependencies first, in order of first mention.
import { nearMatches } from '#cli/policy/near.ts';
import * as messages from '#cli/policy/messages.ts';
import type { Manifest, SelectionWalk } from '#types/manifest.ts';

function visit(walk: SelectionWalk, id: string): void {
    if (walk.seen.has(id)) return;
    if (walk.visiting.includes(id)) {
        const chain = [...walk.visiting.slice(walk.visiting.indexOf(id)), id];
        walk.problems.push(messages.circularRequires(chain));
        return;
    }
    const manifest = walk.manifests.get(id);
    if (!manifest) {
        const known = walk.manifests.keys().toArray();
        walk.problems.push(messages.unknownPreset(id, nearMatches(id, known)));
        walk.seen.add(id);
        return;
    }
    walk.visiting.push(id);
    for (const required of manifest.preset.requires) visit(walk, required);
    walk.visiting.pop();
    walk.seen.add(id);
    walk.order.push(manifest);
}

function conflictProblems(order: Manifest[]): string[] {
    const selectedIds = new Set(order.map((manifest) => manifest.preset.id));
    return order.flatMap((manifest) =>
        manifest.preset.conflicts
            .filter((conflict) => selectedIds.has(conflict))
            .map((conflict) => messages.presetConflict(manifest.preset.id, conflict)),
    );
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
 * Resolves preset ids to ordered manifests. Throws SelectionError for unknown, circular or conflicting presets.
 * @param ids the preset ids named
 * @param manifests every preset manifest
 * @returns the manifests, requirements first, in order of first mention
 */
export function selectPresets(ids: string[], manifests: Map<string, Manifest>): Manifest[] {
    const walk: SelectionWalk = { manifests, problems: [], order: [], seen: new Set(), visiting: [] };
    for (const id of ids) visit(walk, id);
    const problems = [...walk.problems, ...conflictProblems(walk.order)];
    if (problems.length > 0) throw new SelectionError([...new Set(problems)]);
    return walk.order;
}

/**
 * The selection for one scope: the root selection plus the scope's own, deduplicated in order.
 * @param rootIds the root preset ids
 * @param scopeIds the scope's preset ids
 * @param manifests every preset manifest
 * @returns the manifests in order
 */
export function selectForScope(rootIds: string[], scopeIds: string[], manifests: Map<string, Manifest>): Manifest[] {
    return selectPresets([...rootIds, ...scopeIds], manifests);
}

/**
 * The language presets in a selection.
 * @param selected the selected manifests
 * @returns the manifests whose kind is language
 */
export function languagePresets(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.preset.kind === 'language');
}
