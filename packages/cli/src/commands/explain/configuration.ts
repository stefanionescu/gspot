import type { Session } from '#cli/types/session.ts';
import { listSettings } from '#cli/settings/available.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { checkStageSchema } from '#cli/schemas/configurations/fields.ts';
import { listRuleFiles, readConfigurations } from '#cli/configurations/manifests.ts';
import type { Explanation, ConfigurationExplanation } from '#cli/types/commands/explain.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 7 calls in this file share it.
function formatList(label: string, values: string[]): string[] {
    return values.length === 0 ? [] : [`${label}: ${values.join(', ')}`];
}

/**
Describe a configuration's detection, checks, rules, and settings.

@param session the repository settings when the caller opened a repository.
@param configurationName the configuration to describe.
@returns the explanation, or undefined for an unknown configuration.
*/
export function explainConfiguration(session: Session | undefined, configurationName: string): Explanation | undefined {
    const configuration = readConfigurations().get(configurationName);
    if (configuration === undefined) return undefined;
    const row: ConfigurationExplanation = {
        name: configuration.name,
        group: configuration.group,
        title: configuration.title,
        description: configuration.description,
        requires: configuration.requires,
        tools: configuration.tools.map((tool) =>
            tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
        ),
        checks: configuration.checks.map((check) => ({ check: check.id, stage: check.stage })),
        settings: listSettings(configuration.name).map((setting) => setting.name),
        rules: (session === undefined ? [] : selectRuleFiles(session))
            .filter((file) => listRuleFiles(configuration).some((rule) => rule.path === file.path))
            .map((file) => file.path),
        alwaysSelected: configuration.always_selected,
    };
    const { detect, files } = configuration;
    const lines = [
        `${row.title} (${row.group} configuration)`,
        '',
        row.description,
        '',
        ...formatList('Detected by', [
            ...detect.extensions,
            ...detect.filenames,
            ...detect.dependencies.map((name) => `${name} in dependencies`),
            ...detect.paths,
            ...detect.project_files.map((path) => `project file ${path}`),
            ...detect.shebangs.map((name) => `shebang ${name}`),
            ...detect.runtimes.map((name) => `runtime ${name}`),
            ...detect.tags.map((tag) => `tag ${tag}`),
            ...Object.entries(detect.content).map(([path, pattern]) => `${path} matching ${pattern}`),
            ...detect.absent_dependencies.map((name) => `${name} absent from dependencies`),
        ]),
        ...formatList('Files', [...files.extensions, ...files.filenames, ...files.paths, ...files.tags]),
        ...(files.languages ? ['Files: every file a language configuration selects'] : []),
        ...(files.prettier_plugins ? ['Files: the file types of the selected Prettier plugins'] : []),
        ...(files.eslint_plugins ? ['Files: the file types of the selected ESLint plugins'] : []),
        ...formatList('Requires', row.requires),
        ...formatList('Tools it pins', row.tools),
        ...checkStageSchema.options.flatMap((stage) =>
            formatList(
                `Checks at ${stage}`,
                row.checks.filter((check) => check.stage === stage).map((check) => check.check),
            ),
        ),
        ...formatList('Settings', row.settings),
        ...formatList('Rules', row.rules),
    ];
    return { kind: 'configuration', subject: configurationName, text: `${lines.join('\n')}\n`, data: row };
}
