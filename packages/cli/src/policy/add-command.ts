import type { ApplyReport } from '#types/emit.ts';
// gspot add and gspot remove: the preset list of the root or of one scope.
import { nearMatches } from '#cli/policy/near.ts';
import { openSession } from '#cli/run/session.ts';
import type { Manifest } from '#types/manifest.ts';
import { scopeHolder } from '#cli/policy/write.ts';
import * as messages from '#cli/policy/messages.ts';
import { findRoot } from '#cli/repository/tracked.ts';
import { probeTool } from '#cli/platform/tool-probe.ts';
import { PolicyError } from '#cli/policy/read-policy.ts';
import { firstRun } from '#cli/lifecycle/first-check.ts';
import { assertPinMatches } from '#cli/run/version-pin.ts';
import type { CommandResult, Session } from '#types/run.ts';
import type { TomlTable, Mutation } from '#types/config.ts';
import { commitPolicy } from '#cli/policy/commit-policy.ts';
import { installTools } from '#cli/lifecycle/install-tools.ts';
import type { AddOptions, RemoveOptions } from '#types/commands.ts';
import { requireChain, selectPresets } from '#cli/presets/select.ts';
import { configurationName, presetManifests } from '#cli/presets/read-manifests.ts';

function presetHolder(raw: TomlTable, scope: string | undefined): TomlTable {
    const holder = scopeHolder(raw, scope);
    if (!holder) throw new PolicyError([messages.scopeMissing(scope ?? '')]);
    return holder;
}

// The checks a new preset brings, and the checks it changes: a preset that adds a fragment to a configuration
// changes what every check that reads that configuration finds.
function arrivedChecks(added: Manifest[], manifests: Map<string, Manifest>): Set<string> {
    const own = added.flatMap((manifest) => manifest.checks.map((check) => check.name));
    const fragments = new Set(
        added.flatMap((manifest) =>
            manifest.configs
                .filter((config) => config.fragment === true)
                .map((config) => configurationName(config.target)),
        ),
    );
    const readers = manifests
        .values()
        .flatMap((manifest) => manifest.checks)
        .filter((check) => fragments.values().some((name) => (check.command ?? []).includes(`{config:${name}}`)))
        .map((check) => check.name);
    return new Set([...own, ...readers]);
}

// A pin that package.json already held is no change to apply, yet its package may be absent: a preset taken out
// and added again leaves the pin and nothing installed. The package manager runs for a missing library too.
function owed(session: Session, added: Manifest[], applied: ApplyReport): ApplyReport {
    const scopes = session.scopes.map((scope) => scope.scope.path);
    const isMissing = added
        .flatMap((manifest) => manifest.tools)
        .some((tool) => tool.kind === 'library' && probeTool(session.root, tool, scopes).state === 'missing');
    return isMissing && applied.packages.length === 0 ? { ...applied, packages: ['package.json'] } : applied;
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
    const { applied, ...result } = await commitPolicy(
        root,
        mutation,
        o.isDryRun,
        `added ${o.presets.join(', ')}${where}`,
    );
    if (applied === undefined) return result;
    // A library the new preset pins is installed now, as at init: the configuration just written imports it.
    const session = await openSession(root);
    const added = selectPresets(o.presets, manifests);
    const installed = await installTools(
        root,
        session.policyFiles.policy.runner.surface,
        owed(session, added, applied),
        true,
    );
    // What the new presets find today enters a baseline, as at init; the checks that were here before keep their counts.
    const arrived = arrivedChecks(added, manifests);
    const { baselines, toolBaselines } = await firstRun(root, arrived);
    const count = [...baselines, ...toolBaselines].reduce((sum, file) => sum + file.count, 0);
    const held = `baseline: ${String(count)} findings of the added presets are held\n`;
    const note = installed === '' ? '' : `${installed}\n`;
    return { ...result, text: `${result.text}${note}${held}` };
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
