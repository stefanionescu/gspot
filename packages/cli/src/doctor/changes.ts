// What changed in the repository since init: presets detected and not selected, configuration not owned, hooks or CI changed by hand, duplicate pins.
import { detectPresets } from '#cli/presets/detect.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { existingTooling } from '#cli/repository/existing-tooling.ts';
import { ownedBy } from '#cli/render/takeover.ts';
import { pinnedTwice } from '#cli/render/runner-surface.ts';
import { carriesHeader } from '#cli/render/templates.ts';
import { renderAll } from '#cli/render/targets.ts';
import { head } from '#cli/repository/tracked.ts';
import type { Session } from '#cli/run/session.ts';
import { everyManifest } from '#cli/run/session.ts';
import type { ChangeReport } from '#types/doctor.ts';

/** The change report for a session. */
export function changeReport(session: Session): ChangeReport {
    const facts = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session).map((manifest) => manifest.preset.id));
    const report: ChangeReport = {
        detectedNotSelected: [],
        configurationNotOwned: [],
        changedOutsideGspot: [],
        pinnedTwice: [],
    };
    for (const proposal of detectPresets(session.repository.files, session.manifests, facts)) {
        if (selected.has(proposal.preset)) continue;
        const manifest = session.manifests.get(proposal.preset);
        if (manifest?.preset.default || manifest?.preset.kind === 'repository') continue;
        report.detectedNotSelected.push({
            preset: proposal.preset,
            evidence: proposal.evidence,
            command: `gspot add ${proposal.preset}`,
        });
    }
    const tooling = existingTooling(session.root, session.repository.files, session.repository.scopes, facts);
    const rendered = new Set(renderAll(session).files.map((file) => file.path));
    for (const config of tooling.configs) {
        const file = session.repository.files.find((entry) => entry.path === config.path);
        if (!file) continue;
        if (rendered.has(config.path) || carriesHeader(head(session.root, config.path, 600))) continue;
        if (ownedBy(config.tool, selected)) {
            report.configurationNotOwned.push({
                path: config.path,
                note: `beside gspot's ${config.tool} configuration`,
                command: `delete it, or gspot set tools.${config.tool}.enabled false --reason "..."`,
            });
            continue;
        }
        const owner = [...session.manifests.values()].find((manifest) =>
            manifest.tools.some((tool) => tool.name === config.tool),
        );
        report.configurationNotOwned.push({
            path: config.path,
            note: owner ? `${config.tool} has a preset` : `${config.tool} has no gspot preset`,
            command: owner ? `gspot add ${owner.preset.id}` : 'none; add a [[check]] entry to run it',
        });
    }
    for (const hook of tooling.hooks) {
        if (hook.kind === 'husky' && session.loaded.policy.hooks.manager !== 'husky')
            report.changedOutsideGspot.push({
                path: `${hook.path}/`,
                note: 'hooks added by hand',
                command: 'gspot sync',
            });
        if (
            hook.kind === 'hooksPath' &&
            hook.path !== '.gspot/hooks' &&
            session.loaded.policy.hooks.manager === 'gspot'
        )
            report.changedOutsideGspot.push({
                path: hook.path,
                note: 'core.hooksPath moved by hand',
                command: 'gspot sync',
            });
    }
    const pinnedNames = everyManifest(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name));
    for (const workflow of tooling.ci) {
        if (workflow === '.github/workflows/gspot.yml') continue;
        const text = head(session.root, workflow, 20_000);
        const lints =
            /\blint\b|gspot check/.test(text) ||
            pinnedNames.some((name) => name.length > 3 && text.includes(`${name} `));
        if (lints)
            report.changedOutsideGspot.push({
                path: workflow,
                note: 'a second lint job',
                command: 'none; informational',
            });
    }
    for (const pin of pinnedTwice(session.root, everyManifest(session)))
        report.pinnedTwice.push({
            tool: pin.tool,
            version: pin.version,
            places: [pin.place, '.config/mise/conf.d/gspot.toml'],
            command: `delete the ${pin.place} line`,
        });
    return report;
}
