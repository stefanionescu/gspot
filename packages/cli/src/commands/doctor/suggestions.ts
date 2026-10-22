import { quoteArgument } from '#cli/system/text.ts';
import { type Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { generate } from '#cli/generation/generate.ts';
import { ROOT_SCOPE_LABEL } from '#cli/config/terminal.ts';
import { readCachedPrefix } from '#cli/system/files/reads.ts';
import { detectConfigurations } from '#cli/repository/detect.ts';
import { type Configuration } from '#cli/types/configurations.ts';
import { hasGeneratedHeader } from '#cli/repository/files/classify.ts';
import { type GenerationResult } from '#cli/types/generation/files.ts';
import { BANNER_BYTES } from '#cli/config/repository/files/classify.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import type { ConfigurationEvidence } from '#cli/types/repository/detect.ts';
import { type Suggestions, type SuggestionRow } from '#cli/types/commands/doctor.ts';
import { type ExistingTools, type ConflictingConfigFile } from '#cli/types/repository/existing.ts';
import { readLintJobs, isEditedInPlace, readExistingTools } from '#cli/repository/existing/tools.ts';

function listDetectedConfigurations(session: Session): ConfigurationEvidence[] {
    const { root, repository, configurations, settingsFile } = session;
    const { dependencyFiles } = repository;
    const settings = settingsFile.settings;
    return detectConfigurations(repository, configurations).flatMap((entry) => {
        if (settings.removed_configurations.includes(entry.configuration)) return [];
        const removedScopes = Object.entries(settings.scopes)
            .filter(([, table]) => table.removed_configurations.includes(entry.configuration))
            .map(([path]) => path);
        if (removedScopes.length === 0) return [entry];
        const files = repository.files.filter((file) => !removedScopes.some((path) => isInScope(file.path, path)));
        const paths = new Set(files.map((file) => file.path));
        return detectConfigurations(
            { root, files, dependencyFiles: dependencyFiles.filter((file) => paths.has(file.path)) },
            new Map([...configurations].filter(([name]) => name === entry.configuration)),
        );
    });
}

function listConfigurationSuggestions(session: Session): Pick<Suggestions, 'detected' | 'suggested' | 'undetected'> {
    const { repository, configurations, settingsFile } = session;
    const selectedConfigurations = listSelectedConfigurations(session.scopes);
    const selected = new Set(selectedConfigurations.map((configuration) => configuration.name));
    const settings = settingsFile.settings;
    const detected = listDetectedConfigurations(session);
    const choices = [
        { path: '', configurations: settings.configurations },
        ...Object.entries(settings.scopes).map(([path, table]) => ({ path, configurations: table.configurations })),
    ];
    const undetected = choices
        .filter(({ configurations: names }) => names.length > 0)
        .flatMap(({ path, configurations: names }) => {
            const evidence = path === '' ? detected : detectConfigurations(repository, configurations, path);
            const found = new Set(evidence.map((entry) => entry.configuration));
            const scopeArgument = path === '' ? '' : ` --scope ${quoteArgument(path)}`;
            return names.flatMap((name) => {
                const configuration = configurations.get(name);
                if (
                    configuration === undefined ||
                    configuration.group === 'general' ||
                    found.has(name) ||
                    !Object.values(configuration.detect).some((patterns) => Object.keys(patterns).length > 0)
                )
                    return [];
                return [
                    {
                        configuration: name,
                        evidence: `no detection evidence in ${path === '' ? ROOT_SCOPE_LABEL : path}`,
                        command: `gspot remove ${name}${scopeArgument} (if you no longer need it)`,
                    },
                ];
            });
        });
    const rows = new Map<string, Suggestions['suggested'][number]>();
    for (const configuration of selectedConfigurations)
        for (const name of configuration.suggests)
            if (!selected.has(name) && !rows.has(name))
                rows.set(name, {
                    configuration: name,
                    evidence: `suggested by ${configuration.name}`,
                    command: `gspot add ${name}`,
                });
    return {
        detected: detected
            .filter((entry) => entry.group !== 'general' && !selected.has(entry.configuration))
            .map(({ configuration, evidence }) => ({ configuration, evidence, command: `gspot add ${configuration}` })),
        suggested: rows.values().toArray(),
        undetected,
    };
}

function buildInactiveFileRow(
    session: Session,
    configFile: ConflictingConfigFile,
    configuration: Configuration,
): SuggestionRow {
    if (configuration.when?.git === true && !session.repository.hasGit)
        return { path: configFile.path, note: `${configFile.tool} requires a Git repository`, command: 'git init' };
    const checks = configuration.checks.filter(
        (check) =>
            (typeof check.tool === 'object' ? Object.values(check.tool) : [check.tool]).includes(configFile.tool) ||
            check.command?.[0] === configFile.tool,
    );
    const note = `no applicable ${configFile.tool} check at level ${session.settingsFile.settings.level}`;
    if (
        session.settingsFile.settings.level === 'recommended' &&
        checks.length > 0 &&
        checks.every((check) => check.level === 'all')
    )
        return { path: configFile.path, note, command: 'gspot set level all' };
    return { path: configFile.path, note: `${note}; add the source files that this check reads` };
}

function buildFileRow(
    session: Session,
    configFile: ConflictingConfigFile,
    tools: Set<string>,
    configuration: Configuration,
): SuggestionRow {
    if (tools.has(configFile.tool))
        return {
            path: configFile.path,
            note: configFile.shared
                ? `beside the generated ${configFile.tool} config file; move any ${configFile.table ?? configFile.key ?? configFile.tool} setting you still need into gspot.toml, then delete the section`
                : `beside the generated ${configFile.tool} config file; move any setting you still need into gspot.toml, then delete the file`,
        };
    if (configuration.group === 'general') return buildInactiveFileRow(session, configFile, configuration);
    return {
        path: configFile.path,
        note: `the ${configuration.name} configuration configures ${configFile.tool}`,
        command: `gspot add ${configuration.name}`,
    };
}

function listUnownedConfigFiles(
    session: Session,
    existingTools: ExistingTools,
    tools: Set<string>,
    generated: GenerationResult,
): SuggestionRow[] {
    const tracked = new Set(session.repository.files.map((file) => file.path));
    const generatedPaths = new Set(generated.files.map((file) => file.path));
    return existingTools.conflictingConfigFiles
        .filter((configFile) => tracked.has(configFile.path) && !generatedPaths.has(configFile.path))
        .filter((configFile) => !isEditedInPlace(configFile, generated.managedKeys))
        .filter(
            (configFile) =>
                !hasGeneratedHeader(readCachedPrefix(session.reads, configFile.path, BANNER_BYTES).toString('utf8')),
        )
        .flatMap((configFile) => {
            const configuration = session.configurations
                .values()
                .find((configuration) => configuration.tools.some((tool) => tool.name === configFile.tool));
            return configuration === undefined ? [] : [buildFileRow(session, configFile, tools, configuration)];
        });
}

/**
 * List setup suggestions for the repository.
 *
 * @param session the repository to compare with the generated files.
 * @returns the suggested changes.
 */
export function listSuggestions(session: Session): Suggestions {
    const configurations = session.neededToolConfigurations;
    const existingTools = readExistingTools(session.reads, session.repository);
    const generated = generate(session);
    const tools = new Set(configurations.flatMap((configuration) => configuration.tools.map((tool) => tool.name)));
    const workflows = new Set(generated.files.filter((file) => file.kind === 'workflow').map((file) => file.path));
    return {
        ...listConfigurationSuggestions(session),
        unowned: listUnownedConfigFiles(session, existingTools, tools, generated),
        lintJobs: readLintJobs(
            session.root,
            existingTools.ci.filter((path) => !workflows.has(path)),
        ).map((path) => ({ path, note: 'an existing lint job' })),
    };
}
