import { posix } from 'node:path';
import { linkSetting } from './settings.ts';
import { formatCheckTable } from './checks.ts';
import type { readCliReference } from './cli.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
import type { CliReference, ReferencePage } from '../types/reference.ts';
import { isInstalledByGspot } from '#cli/configurations/declared-tools.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS, CONFIGURATION_GUIDES } from '../config/reference.ts';
import { formatList, formatTable, formatSection, buildReferencePage, formatReferencePath } from './markdown.ts';

const DETECTION_LIST_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

// The conditions that select a configuration: every kind with patterns, apart from the dependencies that rule it out.
function formatDetectionConditions(detect: Configuration['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (Array.isArray(patterns)) {
            const names = patterns.map((name) => `\`${name}\``);
            const label = DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS];
            return names.length === 0 ? [] : [`${label} ${DETECTION_LIST_FORMAT.format(names)}`];
        }
        return Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``);
    });
}

function formatAbsentDependencies(detect: Configuration['detect']): string {
    const names = detect.absent_dependencies.map((name) => `\`${name}\``);
    return names.length === 0 ? '' : `, unless the repository depends on ${DETECTION_LIST_FORMAT.format(names)}`;
}

// Rule files of a configuration, with the conditions that install each one.
function formatRules(configuration: Configuration, paths: string[]): string {
    const rows = paths.map((path) => {
        const condition = configuration.rules[posix.basename(path)];
        if (condition === undefined) return [`\`${path}\``, 'Always'];
        const conditions = formatDetectionConditions(condition).join(' or ');
        return [`\`${path}\``, `The repository has ${conditions}${formatAbsentDependencies(condition)}.`];
    });
    return formatTable(['Rule file', 'Installed when'], rows);
}

function formatLintRulesOff(configuration: Configuration): string {
    const rows = configuration.eslint.rules_off.map((exclusion) => [
        exclusion.rules.map((rule) => `\`${rule}\``).join(', '),
        exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'All files in the scope',
        exclusion.reason,
    ]);
    return formatTable(['Lint rules', 'Files', 'Why'], rows);
}

// How gspot selects a configuration: always, by its files and dependencies, or by another configuration.
function formatSelection(configuration: Configuration, facts: CliReference): string {
    if (configuration.always_selected)
        return configuration.when?.git === true ? 'Always selected in a Git repository.' : 'Always selected.';
    const conditions = formatDetectionConditions(configuration.detect);
    const selected =
        conditions.length === 0
            ? ''
            : `gspot selects it in a scope with ${conditions.join(', or ')}${formatAbsentDependencies(configuration.detect)}.`;
    const requiredBy = facts.configurations
        .filter((owner) => owner.requires.includes(configuration.name))
        .map((owner) => `[\`${owner.name}\`](${formatReferencePath('configurations', owner.name)})`)
        .join(', ');
    return (
        [selected, requiredBy === '' ? '' : `A configuration that requires it selects it too: ${requiredBy}.`]
            .filter(Boolean)
            .join(' ') || `Select explicitly with \`gspot add ${configuration.name}\`.`
    );
}

// What gspot installs and writes for a configuration, and the folders it keeps out of Git.
function listInstalledSections(configuration: Configuration): [string, string][] {
    const tools = configuration.tools.map((tool) => [
        tool.name,
        (tool.version === undefined ? 'Any' : `\`${tool.version}\``) +
            (isInstalledByGspot(tool) ? '' : ', install it yourself'),
    ]);
    // Two config files can share one target, so each target appears once.
    const targets = [...new Set(configuration.configFiles.map((configFile) => `\`${configFile.target}\``))];
    const ignored = configuration.ignored_paths.map((path) => `\`${path}\``);
    return [
        ['Tools and versions', formatTable(['Tool', 'Version'], tools)],
        ['Files gspot writes', targets.length === 0 ? '' : `gspot writes ${formatList(targets)}.`],
        ['Kept out of Git', ignored.length === 0 ? '' : `${formatList(ignored)}.`],
    ];
}

// The authored guide owns its link title; a missing registered title stops the build.
function formatConfigurationGuide(name: string, guideTitles: Map<string, string>): string {
    const slug = CONFIGURATION_GUIDES[name];
    if (slug === undefined) return '';
    const title = guideTitles.get(slug);
    if (title === undefined) throw new Error(`The guide ${slug} has no loaded page title.`);
    return `The [${title} guide](/${slug}/) explains the setup.`;
}

/**
 * Build the reference page of a shipped configuration: how gspot selects it, its settings, and its checks.
 *
 * @param configuration the parsed configuration
 * @param facts the CLI reference facts
 * @param guideTitles the authored guide titles keyed by slug.
 * @returns the title, summary, and Markdown body
 */
function buildConfigurationPage(
    configuration: Configuration,
    facts: CliReference,
    guideTitles: Map<string, string>,
): ReferencePage {
    const selection = formatSelection(configuration, facts);
    const defaults = Object.entries(configuration.defaults).map(([name, value]) => [
        `\`${name}\``,
        `\`${JSON.stringify(value)}\``,
    ]);
    const settings = (facts.configurationSettings[configuration.name] ?? []).map((setting) => [
        linkSetting(facts.schema, setting.name),
        setting.description,
    ]);
    const sections: [string, string][] = [
        ['Checks', formatCheckTable(configuration.checks)],
        ['Settings', formatTable(['Setting', 'What it sets'], settings)],
        ['Selected when', selection],
        ['Lint rules turned off', formatLintRulesOff(configuration)],
        ['Defaults set for other configurations', formatTable(['Setting', 'Value'], defaults)],
        ['Rules for coding agents', formatRules(configuration, facts.ruleFiles[configuration.name] ?? [])],
        ...listInstalledSections(configuration),
    ];
    const required = configuration.requires
        .map((name) => `[\`${name}\`](${formatReferencePath('configurations', name)})`)
        .join(', ');
    const opening = [
        configuration.description,
        required === '' ? '' : `It requires ${required}.`,
        formatConfigurationGuide(configuration.name, guideTitles),
    ]
        .filter(Boolean)
        .join(' ');
    const body = opening + sections.map(([title, content]) => formatSection(title, content)).join('');
    return buildReferencePage(configuration.name, configuration.description, body);
}

/**
 * Build the grouped configuration index and its pages.
 *
 * @param facts the CLI reference facts
 * @param guideTitles the authored guide titles keyed by slug.
 * @returns the index and each configuration page, keyed by path
 */
export function buildConfigurationPages(
    facts: CliReference,
    guideTitles: Map<string, string>,
): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>([
        [
            `${REFERENCE_FOLDERS.configurations}/index.md`,
            buildReferencePage(
                'Configurations',
                'Choose configurations by the files and tools they check.',
                'gspot selects configurations from the files of each scope. `gspot add <name>` and ' +
                    '`gspot remove <name>` change the selection, and `gspot list` shows it.\n' +
                    Object.entries(GROUP_LABELS)
                        .map(([group, title]) => {
                            const rows = facts.configurations
                                .filter((configuration) => configuration.group === group)
                                .map((configuration) => [
                                    `[\`${configuration.name}\`](${formatReferencePath('configurations', configuration.name)})`,
                                    configuration.description,
                                ]);
                            return formatSection(title, formatTable(['Configuration', 'What it checks'], rows));
                        })
                        .join(''),
            ),
        ],
    ]);
    for (const configuration of facts.configurations)
        pages.set(
            `${REFERENCE_FOLDERS.configurations}/${configuration.name}.md`,
            buildConfigurationPage(configuration, facts, guideTitles),
        );
    return pages;
}

type Configuration = ReturnType<typeof readCliReference>['configurations'][number];
