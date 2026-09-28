import { statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { detectKits } from '#cli/kits/detect.ts';
import { pinnedTwice } from '#cli/tools/mise.ts';
import { head } from '#cli/repository/tracked.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { hasHeader } from '#cli/generation/headers.ts';
import { isOwned } from '#cli/policy/adoption/collect.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { MISE_CONFIG_PATH } from '#cli/config/tools/tools.ts';
import { hookLocation } from '#cli/repository/hook-location.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { readOwnership } from '#cli/lifecycle/ownership/owner.ts';
import { CHANGE_HEAD_BYTES } from '#cli/config/commands/doctor.ts';
import type { ChangeRow, ChangeReport } from '#cli/types/commands/doctor.ts';
import { ciLintJobs, existingTooling } from '#cli/repository/existing-tooling.ts';
import type { ExistingTool, ExistingTooling } from '#cli/types/repository/repository.ts';

function recommendedNotSelected(session: Session, selected: Set<string>): ChangeReport['recommendedNotSelected'] {
    const rows = new Map<string, ChangeReport['recommendedNotSelected'][number]>();
    for (const manifest of everyManifest(session.scopes))
        for (const id of manifest.kit.recommends)
            if (!selected.has(id) && !rows.has(id))
                rows.set(id, {
                    configuration: id,
                    evidence: `recommended by ${manifest.kit.name}`,
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
        note: owner ? `${config.tool} has a configuration` : `${config.tool} has no gspot configuration`,
        command: owner ? `gspot add ${owner.kit.name}` : 'none; add a [[check]] entry to run it',
    };
}

function configurationNotOwned(
    session: Session,
    tooling: ExistingTooling,
    selected: Set<string>,
    files: GeneratedFile[],
): ChangeRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const rendered = new Set(files.map((file) => file.path));
    return tooling.configs
        .filter((config) => tracked.has(config.path) && !rendered.has(config.path))
        .filter((config) => !hasHeader(head(session.root, config.path, CHANGE_HEAD_BYTES)))
        .map((config) => configurationRow(session, config, selected));
}

function unownedGeneratedFiles(session: Session): ChangeRow[] {
    const recorded = new Set(readOwnership(session.root).files.map((entry) => entry.path));
    if (session.repository.hasGit) {
        const location = hookLocation(session.root);
        for (const entry of readOwnership(location.root, location.stateDirectory).files)
            recorded.add(relative(session.root, join(location.root, entry.path)).replaceAll('\\', '/'));
    }
    return session.repository.files
        .filter((file) => file.path.startsWith('.gspot/') && !recorded.has(file.path))
        .map((file) => ({
            path: file.path,
            note: 'not recorded as owned; lifecycle commands preserve this file',
            command: 'review the file before moving or adopting it',
        }));
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

/**
 * The change report for a session.
 * @param session the session
 * @returns what changed after init, by kind
 */
export function changeReport(session: Session): ChangeReport {
    const facts = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session.scopes).map((manifest) => manifest.kit.name));
    const tooling = existingTooling(session.root, session.repository.files, facts);
    const rendered = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const generated = new Set(rendered.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        detectedNotSelected: detectKits(session.repository.files, session.manifests, facts)
            .filter((proposal) => !selected.has(proposal.configuration))
            .filter((proposal) => {
                const manifest = session.manifests.get(proposal.configuration);
                return manifest?.kit.default !== true && manifest?.kit.kind !== 'general';
            })
            .map((proposal) => ({
                configuration: proposal.configuration,
                evidence: proposal.evidence,
                command: `gspot add ${proposal.configuration}`,
            })),
        recommendedNotSelected: recommendedNotSelected(session, selected),
        configurationNotOwned: [
            ...configurationNotOwned(session, tooling, selected, rendered.files),
            ...unownedGeneratedFiles(session),
            ...(statSync(join(session.root, 'gspot.local.toml'), { throwIfNoEntry: false }) === undefined
                ? []
                : [
                      {
                          path: 'gspot.local.toml',
                          note: 'No command reads this file. Use --skip for one run.',
                          command: 'gspot check --skip <checks>',
                      },
                  ]),
        ],
        changedOutsideGspot: [
            ...hookRows(session, tooling),
            ...ciLintJobs(
                session.root,
                tooling.ci.filter((path) => !generated.has(path)),
            ).map((path) => ({ path, note: 'an authored lint job', command: 'none; informational' })),
        ],
        pinnedTwice: pinnedTwice(session.root, everyManifest(session.scopes)).map((pin) => ({
            tool: pin.tool,
            version: pin.version,
            places: [pin.place, MISE_CONFIG_PATH],
            command: `delete the ${pin.place} line`,
        })),
    };
}
