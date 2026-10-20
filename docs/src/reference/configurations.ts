import { posix } from 'node:path';
import { linkSetting } from './settings.ts';
import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS, CONFIGURATION_GUIDES } from '../config/reference.ts';
import { formatList, escapeCell, formatTable, formatSection, buildReferencePage } from './markdown.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];

const formatCodeNames = (names: string[]): string => names.map((name) => '`' + name + '`').join(', ');

const linkConfigurations = (names: string[]): string =>
    names.map((name) => `[\`${name}\`](/reference/${REFERENCE_FOLDERS.configurations}/${name}/)`).join(', ');

// The conditions that select: every kind with patterns, apart from the dependencies that rule a selection out.
function formatDetectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (Array.isArray(patterns))
            return patterns.length === 0
                ? []
                : [
                      `${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS].toLowerCase()} ${formatCodeNames(patterns)}`,
                  ];
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
    const rows = paths.map((path) => {
        const condition = manifest.rules[posix.basename(path)];
        if (condition === undefined) return [`\`${path}\``, 'Always'];
        const conditions = formatDetectionConditions(condition).join(' or ');
        return [`\`${path}\``, escapeCell(`The repository has ${conditions}${formatAbsentDependencies(condition)}.`)];
    });
    return formatTable(['Rule file', 'Installed when'], rows);
}

function formatLintRulesOff(manifest: Manifest): string {
    const rows = manifest.eslint.rules_off.map((exclusion) => [
        exclusion.rules.map((rule) => `\`${rule}\``).join(', '),
        exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'All files in the scope',
        escapeCell(exclusion.reason),
    ]);
    return formatTable(['Lint rules', 'Files', 'Why'], rows);
}

function formatConfigurationChecks(manifest: Manifest): string {
    if (manifest.checks.length === 0) return '';
    const rows = manifest.checks.map((check) => [
        `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
        `\`${check.stage}\``,
        `\`${check.level}\``,
        escapeCell(check.summary),
    ]);
    return formatTable(['Check', 'Stage', 'Level', 'What it does'], rows);
}

// How a configuration gets selected: always, by its files and dependencies, or by another configuration.
function formatSelection(manifest: Manifest, data: ReturnType<typeof readReferenceData>): string {
    const { configuration } = manifest;
    if (configuration.always_selected)
        return configuration.when?.git === true ? 'Always selected in a Git repository.' : 'Always selected.';
    const conditions = formatDetectionConditions(manifest.detect);
    const selected =
        conditions.length === 0
            ? ''
            : `gspot selects it in a scope with ${conditions.join(', or ')}${formatAbsentDependencies(manifest.detect)}.`;
    const requiredBy = linkConfigurations(
        data.configurations
            .filter((owner) => owner.configuration.requires.includes(configuration.name))
            .map((owner) => owner.configuration.name),
    );
    return (
        [selected, requiredBy === '' ? '' : `A configuration that requires it selects it too: ${requiredBy}.`]
            .filter(Boolean)
            .join(' ') || `Select explicitly with \`gspot add ${configuration.name}\`.`
    );
}

// What gspot installs and writes for a configuration, and the folders it keeps out of Git.
function listInstalledSections(manifest: Manifest): [string, string][] {
    const tools = manifest.tools.map((tool) => [
        tool.name,
        (tool.version === undefined ? 'Any' : `\`${tool.version}\``) +
            (Object.keys(tool.installers).length === 0 ? ', install it yourself' : ''),
    ]);
    // Two pointers can share one target, so each file appears once.
    const targets = [
        ...new Set(
            manifest.toolFiles.map((toolFile) =>
                toolFile.when === undefined
                    ? `\`${toolFile.target}\``
                    : `\`${toolFile.target}\` (with the [\`${toolFile.when.configuration}\`](/reference/${REFERENCE_FOLDERS.configurations}/${toolFile.when.configuration}/) configuration)`,
            ),
        ),
    ];
    const ignored = manifest.ignored_folders.map((path) => '`' + path + '`');
    return [
        ['Tools and versions', formatTable(['Tool', 'Version'], tools)],
        ['Files gspot writes', targets.length === 0 ? '' : `gspot writes ${formatList(targets)}.`],
        ['Kept out of Git', ignored.length === 0 ? '' : `${formatList(ignored)}.`],
    ];
}

/**
 * Build the reference page of a shipped configuration: how it gets selected, its settings, and its checks.
 *
 * @param manifest the parsed configuration
 * @param data everything the CLI exports for the reference
 * @returns the title, summary, and Markdown body
 */
function buildConfigurationPage(manifest: Manifest, data: ReturnType<typeof readReferenceData>): ReferencePage {
    const { configuration } = manifest;
    const selection = formatSelection(manifest, data);
    const defaults = Object.entries(manifest.defaults).map(([name, value]) => [
        `\`${name}\``,
        `\`${JSON.stringify(value)}\``,
    ]);
    const settings = (data.configurationSettings[manifest.configuration.name] ?? []).map((setting) => [
        linkSetting(data.schema, setting.name),
        escapeCell(setting.summary),
    ]);
    const sections: [string, string][] = [
        ['Checks', formatConfigurationChecks(manifest)],
        ['Settings', formatTable(['Setting', 'What it sets'], settings)],
        ['Selected when', selection],
        ['Lint rules turned off', formatLintRulesOff(manifest)],
        ['Defaults set for other configurations', formatTable(['Setting', 'Value'], defaults)],
        ['Rules for coding agents', formatRules(manifest, data.ruleFiles[manifest.configuration.name] ?? [])],
        ...listInstalledSections(manifest),
    ];
    const required = linkConfigurations(configuration.requires);
    const guide = CONFIGURATION_GUIDES[configuration.name];
    const opening = [
        configuration.description,
        required === '' ? '' : `It requires ${required}.`,
        guide === undefined ? '' : `The [${guide.title} guide](${guide.path}) explains the setup.`,
    ]
        .filter(Boolean)
        .join(' ');
    const body = opening + sections.map(([title, content]) => formatSection(title, content)).join('');
    return buildReferencePage(configuration.name, configuration.description, body);
}

/**
 * Build the grouped configuration index and its pages.
 *
 * @param data everything the CLI exports for the reference
 * @returns the index and each configuration page, keyed by path
 */
export function buildConfigurationPages(data: ReturnType<typeof readReferenceData>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>([
        [
            'configurations/index.md',
            buildReferencePage(
                'Configurations',
                'Choose configurations by the files and tools they check.',
                'gspot selects configurations from the files of each scope. `gspot add <name>` and ' +
                    '`gspot remove <name>` change the selection, and `gspot list` shows it.\n' +
                    Object.entries(data.groups)
                        .map(([group, title]) => {
                            const rows = data.configurations
                                .filter((manifest) => manifest.configuration.group === group)
                                .map(({ configuration }) => [
                                    `[\`${configuration.name}\`](/reference/${REFERENCE_FOLDERS.configurations}/${configuration.name}/)`,
                                    escapeCell(configuration.description),
                                ]);
                            return formatSection(title, formatTable(['Configuration', 'What it checks'], rows));
                        })
                        .join(''),
            ),
        ],
    ]);
    for (const manifest of data.configurations)
        pages.set(`configurations/${manifest.configuration.name}.md`, buildConfigurationPage(manifest, data));
    return pages;
}
