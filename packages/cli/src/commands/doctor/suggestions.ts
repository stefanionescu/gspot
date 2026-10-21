import { quoteArgument } from '#cli/system/text.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { type Session } from '#cli/types/planning.ts';
import { generate } from '#cli/generation/generate.ts';
import { formatScopeLabel } from '#cli/system/terminal.ts';
import { type Manifest } from '#cli/types/configurations.ts';
import { readCachedPrefix } from '#cli/system/files/reads.ts';
import { hasGeneratedHeader } from '#cli/repository/classify.ts';
import { BANNER_BYTES } from '#cli/config/repository/inventory.ts';
import { listSelectedManifests } from '#cli/configurations/select.ts';
import { type GenerationResult } from '#cli/types/generation/files.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/selection.ts';
import { hasDetectionRules, detectConfigurations } from '#cli/repository/detect.ts';
import { type Suggestions, type SuggestionRow } from '#cli/types/commands/doctor.ts';
import { type ExistingTools, type FoundToolFile } from '#cli/types/repository/inventory.ts';

import {
    readLintJobs,
    isEditedInPlace,
    readExistingTools,
    getToolFileSection,
} from '#cli/repository/existing-tools.ts';

function listDetectedConfigurations(session: Session): ConfigurationEvidence[] {
    const { root, repository, manifests, settingsFile } = session;
    const { dependencyFiles } = repository;
    const settings = settingsFile.settings;
    return detectConfigurations(repository, manifests).flatMap((entry) => {
        if (settings.removed_configurations.includes(entry.configuration)) return [];
        const removedScopes = Object.entries(settings.scopes)
            .filter(([, table]) => table.removed_configurations.includes(entry.configuration))
            .map(([path]) => path);
        if (removedScopes.length === 0) return [entry];
        const files = repository.files.filter((file) => !removedScopes.some((path) => isInScope(file.path, path)));
        const paths = new Set(files.map((file) => file.path));
        return detectConfigurations(
            { root, files, dependencyFiles: dependencyFiles.filter((file) => paths.has(file.path)) },
            new Map([...manifests].filter(([name]) => name === entry.configuration)),
        );
    });
}

function listConfigurationSuggestions(session: Session): Pick<Suggestions, 'detected' | 'suggested' | 'undetected'> {
    const { repository, manifests, settingsFile } = session;
    const selections = listSelectedManifests(session.scopes);
    const selected = new Set(selections.map((manifest) => manifest.configuration.name));
    const settings = settingsFile.settings;
    const detected = listDetectedConfigurations(session);
    const choices = [
        { path: '', configurations: settings.configurations },
        ...Object.entries(settings.scopes).map(([path, table]) => ({ path, configurations: table.configurations })),
    ];
    const undetected = choices
        .filter(({ configurations }) => configurations.length > 0)
        .flatMap(({ path, configurations }) => {
            const evidence = path === '' ? detected : detectConfigurations(repository, manifests, path);
            const found = new Set(evidence.map((entry) => entry.configuration));
            const scopeArgument = path === '' ? '' : ` --scope ${quoteArgument(path)}`;
            return configurations.flatMap((id) => {
                const manifest = manifests.get(id);
                if (
                    manifest === undefined ||
                    manifest.configuration.group === 'general' ||
                    found.has(id) ||
                    !hasDetectionRules(manifest)
                )
                    return [];
                return [
                    {
                        configuration: id,
                        evidence: `no detection evidence in ${formatScopeLabel(path)}`,
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

function buildInactiveFileRow(session: Session, toolFile: FoundToolFile, manifest: Manifest): SuggestionRow {
    if (manifest.configuration.when?.git === true && !session.repository.hasGit)
        return { path: toolFile.path, note: `${toolFile.tool} requires a Git repository`, command: 'git init' };
    const checks = manifest.checks.filter(
        (check) =>
            (typeof check.tool === 'object' ? Object.values(check.tool) : [check.tool]).includes(toolFile.tool) ||
            check.command?.[0] === toolFile.tool,
    );
    const note = `no applicable ${toolFile.tool} check at level ${session.settingsFile.settings.level}`;
    if (
        session.settingsFile.settings.level === 'recommended' &&
        checks.length > 0 &&
        checks.every((check) => check.level === 'all')
    )
        return { path: toolFile.path, note, command: 'gspot set level all' };
    return { path: toolFile.path, note, command: 'none; add the source files required by this check' };
}

function buildFileRow(
    session: Session,
    toolFile: FoundToolFile,
    tools: Set<string>,
    manifest: Manifest,
): SuggestionRow {
    if (tools.has(toolFile.tool))
        return {
            path: toolFile.path,
            note: `beside the generated ${toolFile.tool} tool file`,
            command: toolFile.shared
                ? `move any ${getToolFileSection(toolFile)} setting you still need into gspot.toml, then delete the section`
                : 'move any setting you still need into gspot.toml, then delete the file',
        };
    if (manifest.configuration.group === 'general') return buildInactiveFileRow(session, toolFile, manifest);
    return {
        path: toolFile.path,
        note: `the ${manifest.configuration.name} configuration configures ${toolFile.tool}`,
        command: `gspot add ${manifest.configuration.name}`,
    };
}

function listUnownedToolFiles(
    session: Session,
    existingTools: ExistingTools,
    tools: Set<string>,
    outputs: GenerationResult,
): SuggestionRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const generated = new Set(outputs.files.map((file) => file.path));
    return existingTools.toolFiles
        .filter((toolFile) => tracked.has(toolFile.path) && !generated.has(toolFile.path))
        .filter((toolFile) => !isEditedInPlace(toolFile, outputs.fileSettings))
        .filter(
            (toolFile) =>
                !hasGeneratedHeader(readCachedPrefix(session.reads, toolFile.path, BANNER_BYTES).toString('utf8')),
        )
        .flatMap((toolFile) => {
            const manifest = session.manifests
                .values()
                .find((manifest) => manifest.tools.some((tool) => tool.name === toolFile.tool));
            return manifest === undefined ? [] : [buildFileRow(session, toolFile, tools, manifest)];
        });
}

/**
 * List setup suggestions for the repository.
 *
 * @param session the repository to compare with the generated files.
 * @returns the suggested changes.
 */
export function listSuggestions(session: Session): Suggestions {
    const manifests = session.neededToolManifests;
    const existingTools = readExistingTools(session.reads, session.repository);
    const generated = generate(session);
    const tools = new Set(manifests.flatMap((manifest) => manifest.tools.map((tool) => tool.name)));
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        ...listConfigurationSuggestions(session),
        unowned: listUnownedToolFiles(session, existingTools, tools, generated),
        lintJobs: readLintJobs(
            session.root,
            existingTools.ci.filter((path) => !workflows.has(path)),
        ).map((path) => ({ path, note: 'an existing lint job', command: 'none; informational' })),
    };
}
