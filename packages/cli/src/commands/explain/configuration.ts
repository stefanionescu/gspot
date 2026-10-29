import type { Session } from '#cli/types/session.ts';
import { selectRuleFiles } from '#cli/generation/rules.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { checkStageSchema } from '#cli/schemas/configurations/fields.ts';
import { listRuleFiles, readConfigurations } from '#cli/configurations/manifests.ts';
import type { Explanation, ConfigurationExplanation } from '#cli/types/commands/explain.ts';

import {
    TOOL_PINS,
    DETECTED_BY,
    ESLINT_FILES_MESSAGE,
    LANGUAGE_FILES_MESSAGE,
    PRETTIER_FILES_MESSAGE,
} from '#cli/config/commands/explain.ts';

/**
Describe a configuration's detection, checks, rules, and settings.

@param session the repository settings when the caller opened a repository.
@param name the configuration to describe.
@returns undefined for an unknown configuration.
*/
export function explainConfiguration(session: Session | undefined, name: string): Explanation | undefined {
    const configuration = readConfigurations().get(name);
    if (configuration === undefined) return undefined;
    const facts: ConfigurationExplanation = {
        name: configuration.name,
        group: configuration.group,
        title: configuration.title,
        description: configuration.description,
        requires: configuration.requires,
        tools: configuration.tools.map((tool) =>
            tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
        ),
        checks: configuration.checks.map((check) => ({ check: check.id, stage: check.stage })),
        settings: (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).map((setting) => setting.name),
        rules: (session === undefined ? [] : selectRuleFiles(session))
            .filter((file) => listRuleFiles(configuration).some((rule) => rule.path === file.path))
            .map((file) => file.path),
        alwaysSelected: configuration.always_selected,
    };
    const { detect, files } = configuration;
    const lists = [
        {
            label: DETECTED_BY,
            values: [
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
            ],
        },
        { label: 'Files', values: [...files.extensions, ...files.filenames, ...files.paths, ...files.tags] },
        { label: 'Files', values: files.languages ? [LANGUAGE_FILES_MESSAGE] : [] },
        { label: 'Files', values: files.prettier_plugins ? [PRETTIER_FILES_MESSAGE] : [] },
        { label: 'Files', values: files.eslint_plugins ? [ESLINT_FILES_MESSAGE] : [] },
        { label: 'Requires', values: facts.requires },
        { label: TOOL_PINS, values: facts.tools },
        ...checkStageSchema.options.map((stage) => ({
            label: `Checks at ${stage}`,
            values: facts.checks.filter((check) => check.stage === stage).map((check) => check.check),
        })),
        { label: 'Settings', values: facts.settings },
        { label: 'Rules', values: facts.rules },
    ];
    const lines = [
        `${facts.title} (${facts.group} configuration)`,
        '',
        facts.description,
        '',
        ...lists.filter(({ values }) => values.length > 0).map(({ label, values }) => `${label}: ${values.join(', ')}`),
    ];
    return { kind: 'configuration', subject: name, text: `${lines.join('\n')}\n`, facts };
}
