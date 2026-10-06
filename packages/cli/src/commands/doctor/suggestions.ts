import { emitAll } from '#cli/generation/outputs.ts';
import { readPrefix } from '#cli/platform/source.ts';
import { duplicateMisePins } from '#cli/tools/mise.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import { hasHeader } from '#cli/parsers/generated-header.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { HEADER_BYTES } from '#cli/config/commands/doctor.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import { detectUnselected } from '#cli/configurations/detect.ts';
import { getTooling, isReplaced } from '#cli/configurations/takeover.ts';
import type { Tooling, ToolFile } from '#cli/types/repository/inventory.ts';
import { applicableManifests } from '#cli/execution/planning/requirements.ts';
import type { Suggestions, SuggestionRow } from '#cli/types/commands/doctor.ts';

function recommendedConfigurations(session: Session, selected: Set<string>): Suggestions['recommended'] {
    const rows = new Map<string, Suggestions['recommended'][number]>();
    for (const manifest of everyManifest(session.scopes))
        for (const id of manifest.configuration.recommends)
            if (!selected.has(id) && !rows.has(id))
                rows.set(id, {
                    configuration: id,
                    evidence: `recommended by ${manifest.configuration.name}`,
                    command: `gspot add ${id}`,
                });
    return rows.values().toArray();
}

function buildFileRow(session: Session, config: ToolFile, selected: Set<string>): SuggestionRow {
    if (isReplaced(config.tool, selected))
        return {
            path: config.path,
            note: `beside the generated ${config.tool} configuration`,
            command: config.shared
                ? `move any ${config.table ?? config.key ?? config.tool} setting you still need into gspot.toml, then delete the section`
                : 'move any setting you still need into gspot.toml, then delete the file',
        };
    const configuration = session.manifests
        .values()
        .find((manifest) => manifest.tools.some((tool) => tool.name === config.tool));
    return {
        path: config.path,
        note: configuration
            ? `the ${configuration.configuration.name} configuration configures ${config.tool}`
            : `${config.tool} has no gspot configuration`,
        command: configuration
            ? `gspot add ${configuration.configuration.name}`
            : 'none; add a [[check]] entry to run it',
    };
}

function unownedConfigs(
    session: Session,
    tooling: Tooling,
    selected: Set<string>,
    outputs: Generated,
): SuggestionRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const generated = new Set(outputs.files.map((file) => file.path));
    return tooling.configs
        .filter((config) => tracked.has(config.path) && !generated.has(config.path))
        .filter(
            (config) =>
                !outputs.configurations.some(
                    (output) =>
                        output.path === config.path && output.changes.some((field) => field.path[0] === config.key),
                ),
        )
        .filter((config) => !hasHeader(readPrefix(session.root, config.path, HEADER_BYTES).toString('utf8')))
        .map((config) => buildFileRow(session, config, selected));
}

function getUnownedOutputs(session: Session): SuggestionRow[] {
    const recorded = new Set(getOwnership(session.root).files.map((entry) => entry.path));
    return session.repository.files
        .filter((file) => file.path.startsWith(`${DOT_GSPOT}/`) && !recorded.has(file.path))
        .map((file) => ({
            path: file.path,
            note: 'gspot did not write this file and will not change it',
            command: 'review the file, then move it into your own files or delete it',
        }));
}

/**
 * Setup suggestions for a repository session.
 * @param session the session
 * @returns detected and recommended configurations, unowned config files, authored lint jobs, and duplicate pins
 */
export function getSuggestions(session: Session): Suggestions {
    const projectManifests = readManifests(session.root, session.repository.files);
    const selected = new Set(everyManifest(session.scopes).map((manifest) => manifest.configuration.name));
    const tooling = getTooling(session.root, session.repository.files, projectManifests);
    const generated = emitAll(session);
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        detected: detectUnselected(
            session.root,
            session.repository.files,
            session.manifests,
            everyManifest(session.scopes),
        ),
        recommended: recommendedConfigurations(session, selected),
        unowned: [...unownedConfigs(session, tooling, selected, generated), ...getUnownedOutputs(session)],
        authored: [
            ...getLintJobs(
                session.root,
                tooling.ci.filter((path) => !workflows.has(path)),
            ).map((path) => ({ path, note: 'an authored lint job', command: 'none; informational' })),
        ],
        duplicateMisePins: duplicateMisePins(
            session.root,
            applicableManifests(session),
            session.policyFiles.policy.run_with,
        ).map((pin) => ({
            tool: pin.tool,
            version: pin.version,
            places: ['mise.toml', pin.gspotFile],
            command: 'delete the mise.toml line',
        })),
    };
}
