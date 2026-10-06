import { emitAll } from '#cli/generation/outputs.ts';
import { readPrefix } from '#cli/platform/source.ts';
import { duplicateMisePins } from '#cli/tools/mise.ts';
import { getLintJobs } from '#cli/repository/survey.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { getTooling } from '#cli/configurations/takeover.ts';
import { hasHeader } from '#cli/parsers/generated-header.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { HEADER_BYTES } from '#cli/config/commands/doctor.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import type { Session } from '#cli/types/execution/session.ts';
import { getOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { Generated } from '#cli/types/generation/output.ts';
import { detectUnselected } from '#cli/configurations/detect.ts';
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

function inactiveFileRow(session: Session, config: ToolFile, manifest: Manifest): SuggestionRow {
    if (manifest.configuration.when?.git === true && !session.repository.hasGit)
        return { path: config.path, note: `${config.tool} requires a Git repository`, command: 'git init' };
    const checks = manifest.checks.filter((check) => check.tool === config.tool || check.command?.[0] === config.tool);
    const note = `no applicable ${config.tool} check at level ${session.policyFiles.policy.level}`;
    if (
        session.policyFiles.policy.level === 'recommended' &&
        checks.length > 0 &&
        checks.every((check) => check.level === 'all')
    )
        return { path: config.path, note, command: 'gspot set level all' };
    return { path: config.path, note, command: 'none; add the source files required by this check' };
}

function buildFileRow(session: Session, config: ToolFile, tools: Set<string>, configuration: Manifest): SuggestionRow {
    if (tools.has(config.tool))
        return {
            path: config.path,
            note: `beside the generated ${config.tool} configuration`,
            command: config.shared
                ? `move any ${config.table ?? config.key ?? config.tool} setting you still need into gspot.toml, then delete the section`
                : 'move any setting you still need into gspot.toml, then delete the file',
        };
    if (configuration.configuration.kind === 'general') return inactiveFileRow(session, config, configuration);
    return {
        path: config.path,
        note: `the ${configuration.configuration.name} configuration configures ${config.tool}`,
        command: `gspot add ${configuration.configuration.name}`,
    };
}

function unownedConfigs(session: Session, tooling: Tooling, tools: Set<string>, outputs: Generated): SuggestionRow[] {
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
        .flatMap((config) =>
            session.manifests
                .values()
                .filter((manifest) => manifest.tools.some((tool) => tool.name === config.tool))
                .take(1)
                .map((manifest) => buildFileRow(session, config, tools, manifest))
                .toArray(),
        );
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
    const tools = new Set(applicableManifests(session).flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        detected: detectUnselected(
            session.root,
            session.repository.files,
            session.manifests,
            everyManifest(session.scopes),
        ),
        recommended: recommendedConfigurations(session, selected),
        unowned: [...unownedConfigs(session, tooling, tools, generated), ...getUnownedOutputs(session)],
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
