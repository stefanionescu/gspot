// gspot add and gspot remove: the preset list of the root or of one scope.
import { nearMatches } from '#cli/policy/near.ts';
import type { CommandResult } from '#types/run.ts';
import { scopeHolder } from '#cli/policy/write.ts';
import * as messages from '#cli/policy/messages.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { requireChain } from '#cli/presets/select.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { TomlTable, Mutation } from '#types/config.ts';
import { commitPolicy } from '#cli/policy/commit-policy.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
import type { AddOptions, RemoveOptions } from '#types/commands.ts';

function presetHolder(raw: TomlTable, scope: string | undefined): TomlTable {
    const holder = scopeHolder(raw, scope);
    if (!holder) throw new PolicyError([messages.scopeMissing(scope ?? '')]);
    return holder;
}

/**
 * gspot add: appends presets to the root list or to one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
export async function addCommand(o: AddOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = presetManifests();
    for (const id of o.presets)
        if (!manifests.has(id)) {
            const known = manifests.keys().toArray();
            throw new PolicyError([messages.unknownPreset(id, nearMatches(id, known))]);
        }
    const mutation: Mutation = (raw) => {
        const holder = presetHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        for (const id of o.presets) if (!list.includes(id)) list.push(id);
        holder['presets'] = list;
    };
    const where = o.scope === undefined ? '' : ` to scope ${o.scope}`;
    return commitPolicy(root, mutation, o.isDryRun, `added ${o.presets.join(', ')}${where}`);
}

/**
 * gspot remove: drops one preset from the root list or from one scope's list.
 * @param o the parsed flags
 * @returns the command result
 */
export async function removeCommand(o: RemoveOptions): Promise<CommandResult> {
    const root = findRoot(o.cwd);
    assertPinMatches(root);
    const manifests = presetManifests();
    const mutation: Mutation = (raw) => {
        const holder = presetHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        const rootList = (raw['presets'] as string[] | undefined) ?? [];
        const kept = [...new Set([...rootList, ...list])].filter((id) => id !== o.preset);
        const chain = kept.map((id) => requireChain(o.preset, id, manifests)).find((found) => found !== undefined);
        if (chain) throw new PolicyError([messages.withoutRequired(o.preset, chain)]);
        if (!list.includes(o.preset)) throw new PolicyError([messages.presetNotListed(o.preset, o.scope)]);
        holder['presets'] = list.filter((id) => id !== o.preset);
    };
    const where = o.scope === undefined ? '' : ` from scope ${o.scope}`;
    return commitPolicy(
        root,
        mutation,
        o.isDryRun,
        `removed ${o.preset}${where}; files it rendered are gone after apply`,
    );
}
