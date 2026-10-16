import { posix } from 'node:path';
import type { referenceData } from '#cli/reference.ts';
import type { ReferencePage } from '../types/reference.ts';
import { escapeCell, formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS, CONFIGURATION_GUIDES } from '../config/reference.ts';

type Manifest = ReturnType<typeof referenceData>['configurations'][number];

// Describe each detection value, including content expressions.
function formatDetectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) =>
        Array.isArray(patterns)
            ? [
                  `${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]}: ${patterns.map((pattern) => '`' + pattern + '`').join(', ')}`,
              ]
            : Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``),
    );
}

// The configuration's rule files and the conditions that install them.
function formatRules(manifest: Manifest, paths: string[]): string {
    return paths
        .map((path) => {
            const condition = manifest.rules[posix.basename(path)];
            if (condition === undefined) return `- \`${path}\``;
            const conditions = formatDetectionConditions(condition);
            return `- \`${path}\` when the repository matches any of: ${conditions.join(', ')}.`;
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
    if (manifest.checks.length === 0)
        return 'This configuration adds tool files or rules and has no checks of its own.';
    const rows = manifest.checks.map((check): [string, string] => {
        return [
            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
            `Stage \`${check.stage}\`, level \`${check.level}\`. ${escapeCell(check.summary)}`,
        ];
    });
    return formatDefinitions(rows);
}

/**
 * Describe a built-in configuration from its selection, settings, and check owners.
 * @param manifest the validated configuration manifest
 * @param data the CLI reference data
 * @returns its public reference page
 */
function buildConfigurationPage(manifest: Manifest, data: ReturnType<typeof referenceData>): ReferencePage {
    const { configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.toolFiles.map((toolFile) =>
        toolFile.when === undefined
            ? `\`${toolFile.target}\``
            : `\`${toolFile.target}\` when the [${toolFile.when.configuration} configuration](/reference/${REFERENCE_FOLDERS.configurations}/${toolFile.when.configuration}/) is selected`,
    );
    const selected = formatDetectionConditions(manifest.detect)
        .map((condition) => `- ${condition}`)
        .join('\n');
    const requiredBy = data.configurations
        .filter((owner) => owner.configuration.requires.includes(configuration.name))
        .map((owner) => `\`${owner.configuration.name}\``)
        .join(', ');
    const selection = configuration.always_selected
        ? 'Always selected.'
        : [selected, requiredBy === '' ? '' : `Selected when required by: ${requiredBy}.`]
              .filter(Boolean)
              .join('\n\n') || `Select explicitly with \`gspot add ${configuration.name}\`.`;
    const defaults = Object.entries(manifest.defaults).map(
        ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\``,
    );
    const sections: [string, string][] = [
        ['Selected when', selection],
        [
            'Tools you install yourself',
            manifest.tools
                .filter((tool) => Object.keys(tool.installers).length === 0)
                .map((tool) => tool.name)
                .join(', '),
        ],
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
 * @param data CLI reference data
 * @returns generated pages
 */
export function buildConfigurationPages(data: ReturnType<typeof referenceData>): Map<string, ReferencePage> {
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
