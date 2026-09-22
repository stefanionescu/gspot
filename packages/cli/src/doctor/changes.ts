import { ciLintJobs } from '#cli/repository/existing-tooling.ts';
import { MISE_CONFIG_PATH } from '#cli/emit/runner-tasks.ts';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
// What changed in the repository after init: presets detected and not selected, configuration not owned, hooks or CI changed by hand, duplicate pins.
import type { Session } from '#cli/run/types.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { head } from '#cli/repository/tracked.ts';
import { hasHeader } from '#cli/emit/templates.ts';
import { isOwned } from '#cli/lifecycle/takeover.ts';
import { detectPresets } from '#cli/presets/detect.ts';
import { everyManifest } from '#cli/presets/select.ts';
import { pinnedTwice } from '#cli/emit/runner-tasks.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { ChangeReport, ChangeRow } from '#cli/doctor/types.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import type { ExistingTool, ExistingTooling } from '#cli/repository/types.ts';

const HEAD_BYTES = 600;

function detectedNotSelected(
    session: Session,
    facts: ReturnType<typeof readManifests>,
    selected: Set<string>,
): ChangeReport['detectedNotSelected'] {
    return detectPresets(session.repository.files, session.manifests, facts)
        .filter((proposal) => !selected.has(proposal.preset))
        .filter((proposal) => {
            const manifest = session.manifests.get(proposal.preset);
            return manifest?.preset.default !== true && manifest?.preset.kind !== 'policy';
        })
        .map((proposal) => ({
            preset: proposal.preset,
            evidence: proposal.evidence,
            command: `gspot add ${proposal.preset}`,
        }));
}

function recommendedNotSelected(session: Session, selected: Set<string>): ChangeReport['recommendedNotSelected'] {
    const rows = new Map<string, ChangeReport['recommendedNotSelected'][number]>();
    for (const manifest of everyManifest(session))
        for (const id of manifest.preset.recommends)
            if (!selected.has(id) && !rows.has(id))
                rows.set(id, {
                    preset: id,
                    evidence: `recommended by ${manifest.preset.name}`,
                    command: `gspot add ${id}`,
                });
    return rows.values().toArray();
}

function configurationRow(session: Session, config: ExistingTool, selected: Set<string>): ChangeRow {
    if (isOwned(config.tool, selected))
        return {
            path: config.path,
            note: `beside gspot's ${config.tool} configuration`,
            command: 'review gspot.toml and carry settings before removing the authored configuration',
        };
    const owner = session.manifests
        .values()
        .find((manifest) => manifest.tools.some((tool) => tool.name === config.tool));
    return {
        path: config.path,
        note: owner ? `${config.tool} has a preset` : `${config.tool} has no gspot preset`,
        command: owner ? `gspot add ${owner.preset.name}` : 'none; add a [[check]] entry to run it',
    };
}

function configurationNotOwned(session: Session, tooling: ExistingTooling, selected: Set<string>): ChangeRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const rendered = new Set(emitAll(session).files.map((file) => file.path));
    return tooling.configs
        .filter((config) => tracked.has(config.path) && !rendered.has(config.path))
        .filter((config) => !hasHeader(head(session.root, config.path, HEAD_BYTES)))
        .map((config) => configurationRow(session, config, selected));
}

function hookRows(session: Session, tooling: ExistingTooling): ChangeRow[] {
    const tool = session.policyFiles.policy.hooks?.tool;
    if (tool === undefined) return [];
    return tooling.hooks.flatMap((hook) => {
        if (tool !== 'husky' && hook.kind === 'husky')
            return [{ path: `${hook.path}/`, note: 'hooks added by hand', command: 'gspot apply' }];
        return [];
    });
}

function workflowRows(session: Session, tooling: ExistingTooling): ChangeRow[] {
    const generated = new Set(
        emitAll(session)
            .files.filter((file) => file.kind === 'workflow')
            .map((file) => file.path),
    );
    return ciLintJobs(
        session.root,
        tooling.ci.filter((path) => !generated.has(path)),
    ).map((path) => ({ path, note: 'an authored lint job', command: 'none; informational' }));
}

/**
 * The change report for a session.
 * @param session the session
 * @returns what changed after init, by kind
 */
export function changeReport(session: Session): ChangeReport {
    const facts = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session).map((manifest) => manifest.preset.name));
    const tooling = existingTooling(session.root, session.repository.files, session.repository.scopes, facts);
    return {
        detectedNotSelected: detectedNotSelected(session, facts, selected),
        recommendedNotSelected: recommendedNotSelected(session, selected),
        configurationNotOwned: [
            ...configurationNotOwned(session, tooling, selected),
            ...(existsSync(join(session.root, 'gspot.local.toml'))
                ? [
                      {
                          path: 'gspot.local.toml',
                          note: 'No command reads this file. Use --skip for one run.',
                          command: 'gspot check --skip <checks>',
                      },
                  ]
                : []),
        ],
        changedOutsideGspot: [...hookRows(session, tooling), ...workflowRows(session, tooling)],
        pinnedTwice: pinnedTwice(session.root, everyManifest(session)).map((pin) => ({
            tool: pin.tool,
            version: pin.version,
            places: [pin.place, MISE_CONFIG_PATH],
            command: `delete the ${pin.place} line`,
        })),
    };
}
