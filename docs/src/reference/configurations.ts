import { posix } from 'node:path';
import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { escapeCell, formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS, CONFIGURATION_GUIDES } from '../config/reference.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];

const formatCodeNames = (names: string[]): string => names.map((name) => '`' + name + '`').join(', ');

// The conditions that select: every kind with patterns, apart from the dependencies that rule a selection out.
function formatDetectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (Array.isArray(patterns))
            return patterns.length === 0
                ? []
                : [`${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]}: ${formatCodeNames(patterns)}`];
        return Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``);
    });
}

function formatAbsentDependencies(detect: Manifest['detect']): string {
    return detect.absent_dependencies.length === 0
        ? ''
        : `, unless the repository depends on ${formatCodeNames(detect.absent_dependencies)}`;
}

// Rule files of a configuration, with the conditions that install each one.
function formatRules(manifest: Manifest, paths: string[]): string {
    return paths
        .map((path) => {
            const condition = manifest.rules[posix.basename(path)];
            if (condition === undefined) return `- \`${path}\``;
            const conditions = formatDetectionConditions(condition).join(' or ');
            return `- \`${path}\` when the repository has ${conditions}${formatAbsentDependencies(condition)}.`;
        })
        .join('\n');
}

function formatLintRulesOff(manifest: Manifest): string {
    return manifest.eslint.rules_off
        .map((exclusion) => {
            const rules = exclusion.rules.map((rule) => `\`${rule}\``).join(', ');
            const files = exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'all files in the scope';
            return `${rules} for ${files}. ${exclusion.reason}`;
        })
        .map((item) => `- ${item}`)
        .join('\n');
}

function formatConfigurationChecks(manifest: Manifest): string {
    if (manifest.checks.length === 0) return '';
    const rows = manifest.checks.map((check): [string, string] => {
        return [
            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
            `Stage \`${check.stage}\`, level \`${check.level}\`. ${escapeCell(check.summary)}`,
        ];
    });
    return formatDefinitions(rows);
}

// How a configuration gets selected: always, by its files and dependencies, or by another configuration.
function formatSelection(manifest: Manifest, data: ReturnType<typeof readReferenceData>): string {
    const { configuration } = manifest;
    if (configuration.always_selected)
        return configuration.when?.git === true ? 'Always selected in a Git repository.' : 'Always selected.';
    const absent = manifest.detect.absent_dependencies;
    const selected = [
        ...formatDetectionConditions(manifest.detect).map((condition) => `- ${condition}`),
        ...(absent.length === 0 ? [] : [`- Not when the repository depends on ${formatCodeNames(absent)}`]),
    ].join('\n');
    const requiredBy = data.configurations
        .filter((owner) => owner.configuration.requires.includes(configuration.name))
        .map((owner) => `\`${owner.configuration.name}\``)
        .join(', ');
    return (
        [selected, requiredBy === '' ? '' : `Selected when required by: ${requiredBy}.`].filter(Boolean).join('\n\n') ||
        `Select explicitly with \`gspot add ${configuration.name}\`.`
    );
}

/**
 * Build the reference page of a shipped configuration: how it gets selected, its settings, and its checks.
 * @param manifest the parsed configuration
 * @param data everything the CLI exports for the reference
 * @returns the title, summary, and Markdown body
 */
function buildConfigurationPage(manifest: Manifest, data: ReturnType<typeof readReferenceData>): ReferencePage {
    const { configuration } = manifest;
    const tools = manifest.tools.map(
        (tool) =>
            (tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`) +
            (Object.keys(tool.installers).length === 0 ? ' (install it yourself)' : ''),
    );
    const targets = manifest.toolFiles.map((toolFile) =>
        toolFile.when === undefined
            ? `\`${toolFile.target}\``
            : `\`${toolFile.target}\` when the [${toolFile.when.configuration} configuration](/reference/${REFERENCE_FOLDERS.configurations}/${toolFile.when.configuration}/) is selected`,
    );
    const selection = formatSelection(manifest, data);
    const defaults = Object.entries(manifest.defaults).map(
        ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\``,
    );
    const sections: [string, string][] = [
        ['Selected when', selection],
        ['Tools and versions', tools.map((item) => '- ' + item).join('\n')],
        ['Files gspot writes', targets.map((item) => '- ' + item).join('\n')],
        ['Kept out of Git', manifest.ignored_folders.map((path) => '- `' + path + '`').join('\n')],
        ['Checks', formatConfigurationChecks(manifest)],
        [
            'Settings',
            (data.configurationSettings[manifest.configuration.name] ?? [])
                .map((setting) => `- \`${setting.name}\`: ${setting.summary}`)
                .join('\n'),
        ],
        ['Defaults set for other configurations', defaults.map((item) => '- ' + item).join('\n')],
        ['Lint rules turned off', formatLintRulesOff(manifest)],
        ['Rules', formatRules(manifest, data.ruleFiles[manifest.configuration.name] ?? [])],
    ];
    const required = configuration.requires.map((id) => '`' + id + '`').join(', ');
    const opening = configuration.description + (required === '' ? '' : `\n\nRequires: ${required}.`);
    const guide = CONFIGURATION_GUIDES[configuration.name];
    const body =
        opening +
        (guide === undefined ? '' : `\n\nSee the [language guide](/languages/${guide}/).`) +
        sections.map(([title, content]) => formatSection(title, content)).join('');
    return buildReferencePage(configuration.title, configuration.description, body);
}

/**
 * Build the grouped configuration index and its pages.
 * @param data everything the CLI exports for the reference
 * @returns the index and each configuration page, keyed by path
 */
export function buildConfigurationPages(data: ReturnType<typeof readReferenceData>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>([
        [
            'configurations/index.md',
            buildReferencePage(
                'Configuration reference',
                'Choose configurations by the files and tools they check.',
                Object.entries(data.groups)
                    .map(([group, title]) =>
                        formatSection(
                            title,
                            data.configurations
                                .filter((manifest) => manifest.configuration.group === group)
                                .map(
                                    ({ configuration }) =>
                                        `- [${configuration.title}](/reference/configurations/${configuration.name}/): ${configuration.description}`,
                                )
                                .join('\n'),
                        ),
                    )
                    .join(''),
            ),
        ],
    ]);
    for (const manifest of data.configurations)
        pages.set(`configurations/${manifest.configuration.name}.md`, buildConfigurationPage(manifest, data));
    return pages;
}
