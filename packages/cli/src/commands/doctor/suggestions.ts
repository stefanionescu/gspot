import { readBytes } from '#cli/system/files/reads.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { BANNER_BYTES } from '#cli/config/repository/files.ts';
import { isEditedInPlace } from '#cli/repository/conflicts.ts';
import type { Session, Generation } from '#cli/types/tools.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { formatScope, quoteArgument } from '#cli/system/text.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { listDetectedAdditions } from '#cli/repository/proposals.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { readLintJobs, readRepositorySetup } from '#cli/repository/setup.ts';
import { LEVEL_COMMAND, LINT_JOB_NOTE } from '#cli/config/commands/reports.ts';
import type { Suggestions, SuggestionRow } from '#cli/types/commands/reports.ts';
import type { RepositorySetup, ConflictingConfig } from '#cli/types/repository.ts';
import { expandSuggestions, listSelectedConfigurations } from '#cli/manifests/select.ts';

function listConfigurationSuggestions(session: Session): Pick<Suggestions, 'suggested' | 'undetected'> {
    const { repository, settings } = session;
    const configurationsByName = readConfigurations();
    const selectedConfigurations = listSelectedConfigurations(session.scopes);
    const selected = new Set(selectedConfigurations.map((configuration) => configuration.name));
    const choices = [
        { path: '', configurations: settings.configurations },
        ...[...settings.scopes].map(([path, table]) => ({ path, configurations: table.configurations })),
    ];
    const undetected = choices
        .filter(({ configurations: names }) => names.length > 0)
        .flatMap(({ path, configurations: names }) => {
            const evidence = detectConfigurations(repository, configurationsByName, path);
            const found = new Set(evidence.map((detection) => detection.configuration));
            const scopeArgument = path === '' ? '' : ` --scope ${quoteArgument(path)}`;
            return names.flatMap((name) => {
                const configuration = configurationsByName.get(name);
                if (configuration === undefined || configuration.group === 'general' || found.has(name)) return [];
                const hasDetectConditions = Object.values(configuration.detect).some(
                    (patterns) => Object.keys(patterns).length > 0,
                );
                if (!hasDetectConditions) return [];
                return [
                    {
                        configuration: name,
                        evidence: `no files in ${formatScope(path)} yet; remove it if none are planned`,
                        command: `gspot remove ${name}${scopeArgument} --reason "<why>"`,
                    },
                ];
            });
        });
    const detectedNames = new Set(listDetectedAdditions(session).flatMap(({ configurations }) => configurations));
    const rows = new Map<string, Suggestions['suggested'][number]>();
    for (const configuration of selectedConfigurations) {
        const suggested = expandSuggestions([configuration.name], configurationsByName, detectedNames);
        for (const name of suggested)
            if (!selected.has(name) && !rows.has(name))
                rows.set(name, {
                    configuration: name,
                    evidence: `suggested by ${configuration.name}`,
                    command: `gspot add ${name}`,
                });
    }
    return {
        suggested: rows.values().toArray(),
        undetected,
    };
}

function buildInactiveFileRow(
    session: Session,
    config: ConflictingConfig,
    configuration: Configuration,
): SuggestionRow {
    const checks = configuration.checks.filter(
        (check) =>
            [check.tool, ...(check.other_tools ?? [])].includes(config.tool) || check.command?.[0] === config.tool,
    );
    const note = `no applicable ${config.tool} check at level ${session.settings.level}`;
    if (session.settings.level === 'basic' && checks.length > 0 && checks.every((check) => check.level === 'all'))
        return { path: config.path, note, command: LEVEL_COMMAND };
    return { path: config.path, note: `${note}; add the source files that this check reads` };
}

function buildFileRow(
    session: Session,
    config: ConflictingConfig,
    tools: Set<string>,
    configuration: Configuration,
): SuggestionRow {
    if (tools.has(config.tool))
        return {
            path: config.path,
            note: config.shared
                ? `beside the generated file for ${config.tool}; move any ${config.table ?? config.key ?? config.tool} setting you still need into gspot.toml, then delete the section`
                : `beside the generated file for ${config.tool}; move any setting you still need into gspot.toml, then delete the file`,
        };
    if (configuration.group === 'general') return buildInactiveFileRow(session, config, configuration);
    return {
        path: config.path,
        note: `the ${configuration.name} configuration configures ${config.tool}`,
        command: `gspot add ${configuration.name}`,
    };
}

function listUnownedConfigs(
    session: Session,
    repositorySetup: RepositorySetup,
    tools: Set<string>,
    generated: Generation,
): SuggestionRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const generatedPaths = new Set(generated.files.map((file) => file.path));
    return repositorySetup.conflictingConfigs
        .filter((config) => tracked.has(config.path) && !generatedPaths.has(config.path))
        .filter((config) => !isEditedInPlace(config, generated.managedKeys))
        .filter(
            (config) =>
                !hasGeneratedHeader(readBytes(session.cache, config.path, { limit: BANNER_BYTES }).toString('utf8')),
        )
        .flatMap((config) => {
            const configuration = readConfigurations()
                .values()
                .find((configuration) => configuration.tools.some((tool) => tool.name === config.tool));
            return configuration === undefined ? [] : [buildFileRow(session, config, tools, configuration)];
        });
}

/**
List setup suggestions for the repository.

@param session the repository to compare with the generated files.
*/
export async function listSuggestions(session: Session): Promise<Suggestions> {
    const configurations = session.toolConfigurations;
    const repositorySetup = await readRepositorySetup(session.cache, session.repository);
    const generated = buildGeneratedFiles(session);
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        ...listConfigurationSuggestions(session),
        unowned: listUnownedConfigs(session, repositorySetup, tools, generated),
        lintJobs: readLintJobs(
            session.root,
            repositorySetup.ci.filter((path) => !workflows.has(path)),
        ).map((path) => ({ path, note: LINT_JOB_NOTE })),
    };
}
