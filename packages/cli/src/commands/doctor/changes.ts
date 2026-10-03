import { join } from 'node:path';
import { statSync } from 'node:fs';
import { detectKits } from '#cli/kits/detect.ts';
import { pinnedTwice } from '#cli/tools/mise.ts';
import { everyManifest } from '#cli/kits/select.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { hasHeader } from '#cli/generation/headers.ts';
import type { GeneratedFile } from '#cli/types/kits.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import { readPrefix } from '#cli/repository/sources.ts';
import type { Session } from '#cli/types/tools/tools.ts';
import { readManifests } from '#cli/repository/packages.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { HEADER_BYTES } from '#cli/config/commands/doctor.ts';
import { getTooling, isReplaced } from '#cli/kits/takeover.ts';
import { getOwnership } from '#cli/lifecycle/ownership/owner.ts';
import type { Changes, ChangeRow } from '#cli/types/commands/doctor.ts';
import { MISE_CONFIG_PATH } from '#cli/config/generation/generation.ts';
import type { Tooling, ToolFile } from '#cli/types/repository/repository.ts';

function recommendedKits(session: Session, selected: Set<string>): Changes['recommended'] {
    const rows = new Map<string, Changes['recommended'][number]>();
    for (const manifest of everyManifest(session.scopes))
        for (const id of manifest.kit.recommends)
            if (!selected.has(id) && !rows.has(id))
                rows.set(id, {
                    kit: id,
                    evidence: `recommended by ${manifest.kit.name}`,
                    command: `gspot add ${id}`,
                });
    return rows.values().toArray();
}

function buildFileRow(session: Session, config: ToolFile, selected: Set<string>): ChangeRow {
    if (isReplaced(config.tool, selected))
        return {
            path: config.path,
            note: `beside the generated ${config.tool} configuration`,
            command: 'move any setting you still need into gspot.toml, then delete the file',
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

function unownedConfigs(
    session: Session,
    tooling: Tooling,
    selected: Set<string>,
    files: GeneratedFile[],
): ChangeRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const rendered = new Set(files.map((file) => file.path));
    return tooling.configs
        .filter((config) => tracked.has(config.path) && !rendered.has(config.path))
        .filter((config) => !hasHeader(readPrefix(session.root, config.path, HEADER_BYTES).toString('utf8')))
        .map((config) => buildFileRow(session, config, selected));
}

function getUnownedOutputs(session: Session): ChangeRow[] {
    const recorded = new Set(getOwnership(session.root).files.map((entry) => entry.path));
    return session.repository.files
        .filter((file) => file.path.startsWith(`${DOT_GSPOT}/`) && !recorded.has(file.path))
        .map((file) => ({
            path: file.path,
            note: 'not recorded as owned; lifecycle commands preserve this file',
            command: 'review the file, then move it into your own files or delete it',
        }));
}

/**
 * The change report for a session.
 * @param session the session
 * @returns what changed after init, by kind
 */
export function getChanges(session: Session): Changes {
    const fields = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session.scopes).map((manifest) => manifest.kit.name));
    const tooling = getTooling(session.root, session.repository.files, fields);
    const rendered = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    });
    const generated = new Set(rendered.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        detected: detectKits(session.repository.files, session.manifests, fields)
            .filter((plan) => !selected.has(plan.kit))
            .filter((plan) => {
                const manifest = session.manifests.get(plan.kit);
                return manifest?.kit.auto !== true && manifest?.kit.kind !== 'general';
            })
            .map((plan) => ({
                kit: plan.kit,
                evidence: plan.evidence,
                command: `gspot add ${plan.kit}`,
            })),
        recommended: recommendedKits(session, selected),
        unowned: [
            ...unownedConfigs(session, tooling, selected, rendered.files),
            ...getUnownedOutputs(session),
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
        authored: [
            ...getLintJobs(
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
