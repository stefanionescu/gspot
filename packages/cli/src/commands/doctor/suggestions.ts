import { quoteArgument } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import type { Configuration } from '#cli/types/manifests.ts';
import { readCachedPrefix } from '#cli/system/files/reads.ts';
import { BANNER_BYTES } from '#cli/config/repository/files.ts';
import { isEditedInPlace } from '#cli/repository/conflicts.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import type { Generation } from '#cli/types/generation/files.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { readLintJobs, readRepositorySetup } from '#cli/repository/setup.ts';
import type { Suggestions, SuggestionRow } from '#cli/types/commands/doctor.ts';
import { expandSuggestions, listSelectedConfigurations } from '#cli/manifests/select.ts';
import { LEVEL_COMMAND, LINT_JOB_NOTE, GIT_INIT_COMMAND } from '#cli/config/commands/doctor.ts';
import type { RepositorySetup, ConflictingConfig, ConfigurationEvidence } from '#cli/types/repository/repository.ts';

function listDetectedConfigurations(session: Session): ConfigurationEvidence[] {
    const { root, repository, configurationsByName, settings } = session;
    const { dependencyFiles } = repository;
    return detectConfigurations(repository, configurationsByName).flatMap((detection) => {
        if (settings.removed_configurations.includes(detection.configuration)) return [];
        const removedScopes = [...settings.scopes]
            .filter(([, table]) => table.removed_configurations.includes(detection.configuration))
            .map(([path]) => path);
        if (removedScopes.length === 0) return [detection];
        const files = repository.files.filter((file) => removedScopes.every((path) => !isInScope(file.path, path)));
        const paths = new Set(files.map((file) => file.path));
        return detectConfigurations(
            { root, files, dependencyFiles: dependencyFiles.filter((file) => paths.has(file.path)) },
            new Map([...configurationsByName].filter(([name]) => name === detection.configuration)),
        );
    });
}

function listConfigurationSuggestions(session: Session): Pick<Suggestions, 'detected' | 'suggested' | 'undetected'> {
    const { repository, configurationsByName, settings } = session;
    const selectedConfigurations = listSelectedConfigurations(session.scopes);
    const selected = new Set(selectedConfigurations.map((configuration) => configuration.name));
    const detected = listDetectedConfigurations(session);
    const choices = [
        { path: '', configurations: settings.configurations },
        ...[...settings.scopes].map(([path, table]) => ({ path, configurations: table.configurations })),
    ];
    const undetected = choices
        .filter(({ configurations: names }) => names.length > 0)
        .flatMap(({ path, configurations: names }) => {
            const evidence = path === '' ? detected : detectConfigurations(repository, configurationsByName, path);
            const found = new Set(evidence.map((detection) => detection.configuration));
            const scopeArgument = path === '' ? '' : ` --scope ${quoteArgument(path)}`;
            return names.flatMap((name) => {
                const configuration = configurationsByName.get(name);
                if (
                    configuration === undefined ||
                    configuration.group === 'general' ||
                    found.has(name) ||
                    Object.values(configuration.detect).every((patterns) => Object.keys(patterns).length === 0)
                )
                    return [];
                return [
                    {
                        configuration: name,
                        evidence: `no files in ${path === '' ? ROOT_SCOPE_LABEL : path} yet; remove it if none are planned`,
                        command: `gspot remove ${name}${scopeArgument} --reason "<why>"`,
                    },
                ];
            });
        });
    const detectedNames = new Set(detected.map((detection) => detection.configuration));
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
        detected: detected
            .filter((detection) => !selected.has(detection.configuration))
            .map(({ configuration, evidence }) => ({ configuration, evidence, command: `gspot add ${configuration}` })),
        suggested: rows.values().toArray(),
        undetected,
    };
}

function buildInactiveFileRow(
    session: Session,
    config: ConflictingConfig,
    configuration: Configuration,
): SuggestionRow {
    if (configuration.when?.git === true && !session.repository.hasGit)
        return {
            path: config.path,
            note: `${config.tool} requires a Git repository`,
            command: GIT_INIT_COMMAND,
        };
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
                ? `beside the generated ${config.tool} config file; move any ${config.table ?? config.key ?? config.tool} setting you still need into gspot.toml, then delete the section`
                : `beside the generated ${config.tool} config file; move any setting you still need into gspot.toml, then delete the file`,
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
                !hasGeneratedHeader(readCachedPrefix(session.cache, config.path, BANNER_BYTES).toString('utf8')),
        )
        .flatMap((config) => {
            const configuration = session.configurationsByName
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
