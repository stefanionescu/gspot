import { posix } from 'node:path';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import { configurationFiles } from '@gspothq/cli/src/rules/assemble.ts';
import type { Manifest } from '@gspothq/cli/src/types/configurations.ts';
import { DETECTION_LABELS, CONFIGURATION_NOTES } from '../../config/reference.ts';

// A rule file of the configuration, with the condition that installs it when it has one.
function ruleSelection(manifest: Manifest, path: string): string {
    const condition =
        manifest.agent_rules[posix.relative(`${manifest.configuration.kind}/${manifest.configuration.name}`, path)];
    if (condition === undefined) return `\`${path}\``;
    const conditions = Object.entries(condition).flatMap(([kind, patterns]) =>
        patterns.map((pattern) => `${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]} \`${pattern}\``),
    );
    return `\`${path}\` when the repository matches any of: ${conditions.join(', ')}.`;
}

function ruleExclusions(manifest: Manifest): string {
    return manifest.eslint_rules_off
        .map((exclusion) => {
            const rules = exclusion.rules.map((rule) => `\`${rule}\``).join(', ');
            const files = exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'all files in the scope';
            const condition =
                exclusion.when === undefined
                    ? ''
                    : ` when \`${exclusion.when.setting}\` is \`${JSON.stringify(exclusion.when.value)}\``;
            return `${rules} for ${files}${condition}. ${exclusion.reason}`;
        })
        .map((item) => `- ${item}`)
        .join('\n');
}

function configurationChecks(manifest: Manifest): string {
    if (manifest.checks.length === 0)
        return 'This configuration adds tool configuration or agent rules and has no checks of its own.';
    const rows = manifest.checks.map((check) => {
        const owner = check.name.slice(0, check.name.indexOf('/'));
        const borrowed = manifest.configuration.borrowed_checks.includes(check.name)
            ? ' (' + owner + ' configuration)'
            : '';
        return [
            `[\`${check.name}\`](/reference/checks/${check.name}/)${borrowed}`,
            check.stage,
            check.level,
            cell(check.summary),
        ];
    });
    return table(['Check', 'Stage', 'Level', 'What it finds'], rows);
}

/**
 * Describe a built-in configuration from its selection, settings, and check owners.
 * @param manifest the validated configuration manifest
 * @returns its public reference page
 */
export function configurationPage(manifest: Manifest): ReferencePage {
    const { configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) =>
        config.when === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.when.configuration} configuration](/reference/configurations/${config.when.configuration}/) is selected`,
    );
    const selected = Object.entries(manifest.detect)
        .map(([kind, patterns]) => {
            const spellings = patterns.map((pattern) => '`' + pattern + '`').join(', ');
            return `- ${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]}: ${spellings}`;
        })
        .join('\n');
    const selection = configuration.always_selected
        ? 'Selected by default. Tool requirements depend on applicable checks.'
        : selected || `Select explicitly with \`gspot add ${configuration.name}\`.`;
    const defaults = [
        ...Object.entries(manifest.set).map(
            ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\` at level recommended`,
        ),
        ...Object.entries(manifest.set_all).map(
            ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\` at level all`,
        ),
    ];
    const hostTools = manifest.tools
        .filter((tool) => Object.keys(tool.installers).length === 0)
        .map((tool) => tool.name);
    const installation =
        'Install the project runtime and application dependencies. Run `gspot install` for applicable pinned tools. Native tools use mise or the commands from `gspot doctor`. Declared pins are installed only when an applicable check, fixer, or generator requires them.';
    const sections: [string, string][] = [
        ['Selected when', selection],
        ['You install', installation + (hostTools.length === 0 ? '' : ` Host tools: ${hostTools.join(', ')}.`)],
        ['Declared tool pins', tools.map((item) => '- ' + item).join('\n')],
        ['Generated tool files', targets.map((item) => '- ' + item).join('\n')],
        ['Kept out of Git', manifest.ignored.map((path) => '- `' + path + '`').join('\n')],
        ['Checks', configurationChecks(manifest)],
        ['Details', CONFIGURATION_NOTES[configuration.name] ?? ''],
        ['Settings', manifest.settings.map((setting) => `- \`${setting.name}\`: ${setting.summary}`).join('\n')],
        ['Defaults set for other configurations', defaults.map((item) => '- ' + item).join('\n')],
        ['Rule exclusions', ruleExclusions(manifest)],
        [
            'Rules for coding agents',
            configurationFiles(manifest)
                .map((file) => '- ' + ruleSelection(manifest, file.path))
                .join('\n'),
        ],
    ];
    const required = configuration.requires.map((id) => '`' + id + '`').join(', ');
    const opening = configuration.description + (required === '' ? '' : `\n\nRequires: ${required}.`);
    const body = opening + sections.map(([title, content]) => section(title, content)).join('');
    return referencePage(
        configuration.title,
        configuration.description,
        body,
        `packages/cli/${manifest.dir}/manifest.toml`,
    );
}
