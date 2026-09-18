// Selection: the presets named plus every preset they require, dependencies first, in order of first mention.
import * as messages from '#cli/policy/messages.ts';
import { nearMatches } from '#cli/policy/near.ts';
import type { Manifest } from '#types/manifest.ts';

export class SelectionError extends Error {
    readonly problems: string[];

    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'SelectionError';
        this.problems = problems;
    }
}

/** Resolves preset ids to ordered manifests. Throws SelectionError for unknown, circular or conflicting presets. */
export function selectPresets(ids: string[], manifests: Map<string, Manifest>): Manifest[] {
    const problems: string[] = [];
    const order: Manifest[] = [];
    const seen = new Set<string>();
    const visiting: string[] = [];
    const visit = (id: string) => {
        if (seen.has(id)) return;
        if (visiting.includes(id)) {
            problems.push(messages.circularRequires([...visiting.slice(visiting.indexOf(id)), id]));
            return;
        }
        const manifest = manifests.get(id);
        if (!manifest) {
            problems.push(messages.unknownPreset(id, nearMatches(id, [...manifests.keys()])));
            seen.add(id);
            return;
        }
        visiting.push(id);
        for (const required of manifest.preset.requires) visit(required);
        visiting.pop();
        seen.add(id);
        order.push(manifest);
    };
    for (const id of ids) visit(id);
    const selectedIds = new Set(order.map((manifest) => manifest.preset.id));
    for (const manifest of order) {
        for (const conflict of manifest.preset.conflicts)
            if (selectedIds.has(conflict)) problems.push(messages.presetConflict(manifest.preset.id, conflict));
    }
    if (problems.length > 0) throw new SelectionError([...new Set(problems)]);
    return order;
}

/** The selection for one scope: the root selection plus the scope's own, deduplicated in order. */
export function selectForScope(rootIds: string[], scopeIds: string[], manifests: Map<string, Manifest>): Manifest[] {
    return selectPresets([...rootIds, ...scopeIds], manifests);
}

/** The language presets in a selection. */
export function languagePresets(selected: Manifest[]): Manifest[] {
    return selected.filter((manifest) => manifest.preset.kind === 'language');
}
