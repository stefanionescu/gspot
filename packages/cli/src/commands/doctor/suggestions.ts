import { emitAll } from '#cli/generation/files.ts';
import { quoteArgument } from '#cli/system/text.ts';
import { type Session } from '#cli/types/planning.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { HEADER_BYTES } from '#cli/config/commands/doctor.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { readCachedPrefix } from '#cli/system/files/reads.ts';
import { type Generated } from '#cli/types/generation/files.ts';
import { hasGeneratedHeader } from '#cli/repository/classify.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { readTooling, readLintJobs } from '#cli/repository/existing-tools.ts';
import { type Suggestions, type SuggestionRow } from '#cli/types/commands/doctor.ts';
import { type Tooling, type FoundToolFile } from '#cli/types/repository/inventory.ts';

function configurationSuggestions(session: Session): Pick<Suggestions, 'detected' | 'suggested' | 'undetected'> {
    const { root, repository, manifests, packageManifests, settingsFile } = session;
    const selections = everyManifest(session.scopes);
    const selected = new Set(selections.map((manifest) => manifest.configuration.name));
    const detected = detectConfigurations(root, repository.files, manifests, packageManifests);
    const settings = settingsFile.settings;
    const choices = [
        { path: '', configurations: settings.configurations },
        ...Object.entries(settings.scope).map(([path, table]) => ({ path, configurations: table.configurations })),
    ];
    const undetected = choices
        .filter(({ configurations }) => configurations.length > 0)
        .flatMap(({ path, configurations }) => {
            const evidence =
                path === ''
                    ? detected
                    : detectConfigurations(root, repository.files, manifests, packageManifests, path);
            const found = new Set(evidence.map((entry) => entry.configuration));
            const scopeArgument = path === '' ? '' : ` --scope ${quoteArgument(path)}`;
            return configurations.flatMap((id) => {
                const manifest = manifests.get(id);
                if (
                    manifest === undefined ||
                    manifest.configuration.group === 'general' ||
                    found.has(id) ||
                    !Object.values(manifest.detect).some((patterns) => Object.keys(patterns).length > 0)
                )
                    return [];
                return [
                    {
                        configuration: id,
                        evidence: `no detection evidence in ${path === '' ? 'root' : path}`,
                        command: `gspot remove ${id}${scopeArgument} (if you no longer need it)`,
                    },
                ];
            });
        });
    const rows = new Map<string, Suggestions['suggested'][number]>();
    for (const manifest of selections)
        for (const id of manifest.configuration.suggests)
            if (!selected.has(id) && !rows.has(id))
                rows.set(id, {
                    configuration: id,
                    evidence: `suggested by ${manifest.configuration.name}`,
                    command: `gspot add ${id}`,
                });
    return {
        detected: detected
            .filter((entry) => entry.group !== 'general' && !selected.has(entry.configuration))
            .map(({ configuration, evidence }) => ({ configuration, evidence, command: `gspot add ${configuration}` })),
        suggested: rows.values().toArray(),
        undetected,
    };
}

function inactiveFileRow(session: Session, config: FoundToolFile, manifest: Manifest): SuggestionRow {
    if (manifest.configuration.when?.git === true && !session.repository.hasGit)
        return { path: config.path, note: `${config.tool} requires a Git repository`, command: 'git init' };
    const checks = manifest.checks.filter(
        (check) =>
            (typeof check.tool === 'object' ? Object.values(check.tool) : [check.tool]).includes(config.tool) ||
            check.command?.[0] === config.tool,
    );
    const note = `no applicable ${config.tool} check at level ${session.settingsFile.settings.level}`;
    if (
        session.settingsFile.settings.level === 'recommended' &&
        checks.length > 0 &&
        checks.every((check) => check.level === 'all')
    )
        return { path: config.path, note, command: 'gspot set level all' };
    return { path: config.path, note, command: 'none; add the source files required by this check' };
}

function buildFileRow(
    session: Session,
    config: FoundToolFile,
    tools: Set<string>,
    configuration: Manifest,
): SuggestionRow {
    if (tools.has(config.tool))
        return {
            path: config.path,
            note: `beside the generated ${config.tool} tool file`,
            command: config.shared
                ? `move any ${config.table ?? config.key ?? config.tool} setting you still need into gspot.toml, then delete the section`
                : 'move any setting you still need into gspot.toml, then delete the file',
        };
    if (configuration.configuration.group === 'general') return inactiveFileRow(session, config, configuration);
    return {
        path: config.path,
        note: `the ${configuration.configuration.name} configuration configures ${config.tool}`,
        command: `gspot add ${configuration.configuration.name}`,
    };
}

function unownedToolFiles(session: Session, tooling: Tooling, tools: Set<string>, outputs: Generated): SuggestionRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const generated = new Set(outputs.files.map((file) => file.path));
    return tooling.toolFiles
        .filter((config) => tracked.has(config.path) && !generated.has(config.path))
        .filter(
            (config) =>
                !outputs.fileEdits.some(
                    (output) =>
                        output.path === config.path && output.changes.some((field) => field.path[0] === config.key),
                ),
        )
        .filter(
            (config) =>
                !hasGeneratedHeader(readCachedPrefix(session.reads, config.path, HEADER_BYTES).toString('utf8')),
        )
        .flatMap((config) =>
            session.manifests
                .values()
                .filter((manifest) => manifest.tools.some((tool) => tool.name === config.tool))
                .take(1)
                .map((manifest) => buildFileRow(session, config, tools, manifest))
                .toArray(),
        );
}

/**
 * Setup suggestions for a repository session.
 * @param session the session
 * @returns detected and suggested configurations, unowned tool files, existing lint jobs
 */
export function listSuggestions(session: Session): Suggestions {
    const { packageManifests } = session;
    const manifests = session.neededToolManifests;
    const tooling = readTooling(session.root, session.repository.files, packageManifests, session.reads);
    const generated = emitAll(session);
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        ...configurationSuggestions(session),
        unowned: unownedToolFiles(session, tooling, tools, generated),
        written: [
            ...readLintJobs(
                session.root,
                tooling.ci.filter((path) => !workflows.has(path)),
            ).map((path) => ({ path, note: 'an existing lint job', command: 'none; informational' })),
        ],
    };
}
