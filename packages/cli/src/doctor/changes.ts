// What changed in the repository after init: presets detected and not selected, configuration not owned, hooks or CI changed by hand, duplicate pins.
import type { Session } from '#types/run.ts';
import { emitAll } from '#cli/emit/targets.ts';
import { head } from '#cli/repository/tracked.ts';
import { hasHeader } from '#cli/emit/templates.ts';
import { everyManifest } from '#cli/run/session.ts';
import { isOwned } from '#cli/lifecycle/takeover.ts';
import { detectPresets } from '#cli/presets/detect.ts';
import { pinnedTwice } from '#cli/emit/runner-surface.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { ChangeReport, ChangeRow } from '#types/doctor.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import type { ExistingTool, ExistingTooling } from '#types/repository.ts';

const HEAD_BYTES = 600;
const WORKFLOW_BYTES = 20_000;
const SHORT_NAME = 3;
const LINT_WORDS = /\blint\b|gspot check/u;

function detectedNotSelected(
    session: Session,
    facts: ReturnType<typeof readManifests>,
    selected: Set<string>,
): ChangeReport['detectedNotSelected'] {
    return detectPresets(session.repository.files, session.manifests, facts)
        .filter((proposal) => !selected.has(proposal.preset))
        .filter((proposal) => {
            const manifest = session.manifests.get(proposal.preset);
            return manifest?.preset.default !== true && manifest?.preset.kind !== 'concern';
        })
        .map((proposal) => ({
            preset: proposal.preset,
            evidence: proposal.evidence,
            command: `gspot add ${proposal.preset}`,
        }));
}

function configurationRow(session: Session, config: ExistingTool, selected: Set<string>): ChangeRow {
    if (isOwned(config.tool, selected))
        return {
            path: config.path,
            note: `beside gspot's ${config.tool} configuration`,
            command: `delete it, or gspot set tools.${config.tool}.enabled false --reason "..."`,
        };
    const owner = session.manifests
        .values()
        .find((manifest) => manifest.tools.some((tool) => tool.name === config.tool));
    return {
        path: config.path,
        note: owner ? `${config.tool} has a preset` : `${config.tool} has no gspot preset`,
        command: owner ? `gspot add ${owner.preset.id}` : 'none; add a [[check]] entry to run it',
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
    const { tool } = session.policyFiles.policy.hooks;
    return tooling.hooks.flatMap((hook) => {
        if (tool !== 'husky' && hook.kind === 'husky')
            return [{ path: `${hook.path}/`, note: 'hooks added by hand', command: 'gspot apply' }];
        if (tool === 'gspot' && hook.kind === 'hooksPath' && hook.path !== '.gspot/hooks')
            return [{ path: hook.path, note: 'core.hooksPath moved by hand', command: 'gspot apply' }];
        return [];
    });
}

function workflowRows(session: Session, tooling: ExistingTooling): ChangeRow[] {
    const pinnedNames = everyManifest(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    return tooling.ci
        .filter((workflow) => workflow !== '.github/workflows/gspot.yml')
        .filter((workflow) => {
            const text = head(session.root, workflow, WORKFLOW_BYTES);
            return (
                LINT_WORDS.test(text) ||
                pinnedNames.some((name) => name.length > SHORT_NAME && text.includes(`${name} `))
            );
        })
        .map((workflow) => ({ path: workflow, note: 'a second lint job', command: 'none; informational' }));
}

/**
 * The change report for a session.
 * @param session the session
 * @returns what changed after init, by kind
 */
export function changeReport(session: Session): ChangeReport {
    const facts = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session).map((manifest) => manifest.preset.id));
    const tooling = existingTooling(session.root, session.repository.files, session.repository.scopes, facts);
    return {
        detectedNotSelected: detectedNotSelected(session, facts, selected),
        configurationNotOwned: configurationNotOwned(session, tooling, selected),
        changedOutsideGspot: [...hookRows(session, tooling), ...workflowRows(session, tooling)],
        pinnedTwice: pinnedTwice(session.root, everyManifest(session)).map((pin) => ({
            tool: pin.tool,
            version: pin.version,
            places: [pin.place, '.config/mise/conf.d/gspot.toml'],
            command: `delete the ${pin.place} line`,
        })),
    };
}
