// gspot add and gspot remove: the preset list of the root or of one scope.
import { nearMatches } from '#cli/policy/near.ts';
import { openSession } from '#cli/run/session.ts';
import { scopeHolder } from '#cli/policy/write.ts';
import * as messages from '#cli/policy/messages.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { CommandResult } from '#cli/run/types.ts';
import type { Mutation } from '#cli/policy/types.ts';
import { commitPolicy } from '#cli/policy/commit-policy.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import { presetManifests } from '#cli/presets/read-manifests.ts';
type AddOptions = { cwd: string; isDryRun: boolean; presets: string[]; scope?: string };
type RemoveOptions = { cwd: string; isDryRun: boolean; preset: string; scope?: string };
import { requireChain } from '#cli/presets/select.ts';

async function installChangedSelection(
    root: string,
    changed: Awaited<ReturnType<typeof commitPolicy>>,
): Promise<CommandResult> {
    const { applied, ...result } = changed;
    if (applied === undefined) return result;
    const session = await openSession(root);
    const installed = await installTools(session, true);
    const note = installed === '' ? '' : `${installed}\n`;
    return { ...result, text: `${result.text}${note}Run gspot check to check the selected presets.\n` };
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
        const holder = scopeHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        for (const id of o.presets) if (!list.includes(id)) list.push(id);
        holder['presets'] = list;
    };
    const where = o.scope === undefined ? '' : ` to scope ${o.scope}`;
    const result = await commitPolicy(root, mutation, o.isDryRun, `added ${o.presets.join(', ')}${where}`);
    return installChangedSelection(root, result);
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
        const holder = scopeHolder(raw, o.scope);
        const list = (holder['presets'] as string[] | undefined) ?? [];
        const rootList = (raw['presets'] as string[] | undefined) ?? [];
        const kept = [...new Set([...rootList, ...list])].filter((id) => id !== o.preset);
        const chain = kept.map((id) => requireChain(o.preset, id, manifests)).find((found) => found !== undefined);
        if (chain) throw new PolicyError([messages.withoutRequired(o.preset, chain)]);
        if (!list.includes(o.preset)) throw new PolicyError([messages.presetNotListed(o.preset, o.scope)]);
        holder['presets'] = list.filter((id) => id !== o.preset);
    };
    const where = o.scope === undefined ? '' : ` from scope ${o.scope}`;
    const result = await commitPolicy(root, mutation, o.isDryRun, `removed ${o.preset}${where}`);
    return installChangedSelection(root, result);
}
