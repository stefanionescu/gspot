import { posix } from 'node:path';
import { CLI_REFERENCE } from './cli.ts';
import { linkSetting } from './settings.ts';
import { formatCheckTable } from './checks.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import { isInstalledByGspot } from '#cli/configurations/tools.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
import type { GuideSlug, ReferencePage } from '../types/reference.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { formatTable, formatSection, buildReferencePage, formatReferencePath } from './markdown.ts';

import {
    DETECTION_LABELS,
    REFERENCE_FOLDERS,
    DISJUNCTION_FORMAT,
    CONJUNCTION_FORMAT,
    CONFIGURATION_GUIDES,
} from '../config/reference.ts';

function formatDetectionConditions(detect: Configuration['detect']): string[] {
    const conditions: string[] = [];
    for (const [kind, patterns] of Object.entries(detect)) {
        if (kind === 'absent_dependencies') continue;
        if (!Array.isArray(patterns)) {
            conditions.push(
                ...Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``),
            );
            continue;
        }
        const names = patterns.map((name) => `\`${name}\``);
        if (names.length === 0) continue;
        const label = DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS];
        conditions.push(`${label} ${DISJUNCTION_FORMAT.format(names)}`);
    }
    return conditions;
}

function formatAbsentDependencies(detect: Configuration['detect']): string {
    const names = detect.absent_dependencies.map((name) => `\`${name}\``);
    return names.length === 0 ? '' : `, unless the repository depends on ${DISJUNCTION_FORMAT.format(names)}`;
}

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

function formatSelection(configuration: Configuration): string {
    if (configuration.always_selected)
        return configuration.when?.git === true ? 'Always selected in a Git repository.' : 'Always selected.';
    const conditions = formatDetectionConditions(configuration.detect);
    const selected =
        conditions.length === 0
            ? ''
            : `gspot selects it in a scope with ${conditions.join(', or ')}${formatAbsentDependencies(configuration.detect)}.`;
    const requiredBy = CLI_REFERENCE.configurations
        .filter((owner) => owner.requires.includes(configuration.name))
        .map((owner) => `[\`${owner.name}\`](${formatReferencePath('configurations', owner.name)})`)
        .join(', ');
    return (
        [selected, requiredBy === '' ? '' : `A configuration that requires it selects it too: ${requiredBy}.`]
            .filter(Boolean)
            .join(' ') || `Select explicitly with \`gspot add ${configuration.name}\`.`
    );
}

function listInstalledSections(configuration: Configuration): [string, string][] {
    const tools = configuration.tools.map((tool) => [
        tool.name,
        (tool.version === undefined ? 'Any' : `\`${tool.version}\``) +
            (isInstalledByGspot(tool) ? '' : ', install it yourself'),
    ]);
    const targets = [...new Set(configuration.configFiles.map((configFile) => `\`${configFile.target}\``))];
    const ignored = configuration.ignored_paths.map((path) => `\`${path}\``);
    return [
        ['Tools and versions', formatTable(['Tool', 'Version'], tools)],
        ['Files gspot writes', targets.length === 0 ? '' : `gspot writes ${CONJUNCTION_FORMAT.format(targets)}.`],
        ['Kept out of Git', ignored.length === 0 ? '' : `${CONJUNCTION_FORMAT.format(ignored)}.`],
    ];
}

function formatConfigurationGuide(name: string, guideTitles: Record<GuideSlug, string>): string {
    const slug = CONFIGURATION_GUIDES[name];
    if (slug === undefined) return '';
    const title = guideTitles[slug];
    return `The [${title} guide](/${slug}/) explains the setup.`;
}

function buildConfigurationPage(configuration: Configuration, guideTitles: Record<GuideSlug, string>): ReferencePage {
    const selection = formatSelection(configuration);
    const defaults = Object.entries(configuration.defaults).map(([name, value]) => [
        `\`${name}\``,
        `\`${JSON.stringify(value)}\``,
    ]);
    const settings = (SETTINGS_BY_CONFIGURATION.get(configuration.name) ?? []).map((setting) => [
        linkSetting(setting.name),
        setting.description,
    ]);
    const ruleFiles = listRuleFiles(configuration).map(({ path }) => posix.join(GSPOT_PATHS.configurations, path));
    const sections: [string, string][] = [
        ['Checks', formatCheckTable(configuration.checks)],
        ['Settings', formatTable(['Setting', 'What it sets'], settings)],
        ['Selected when', selection],
        ['Lint rules turned off', formatLintRulesOff(configuration)],
        ['Defaults set for other configurations', formatTable(['Setting', 'Value'], defaults)],
        ['Rules for coding agents', formatRules(configuration, ruleFiles)],
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
Build the grouped configuration index and its pages.

@param guideTitles the authored guide titles keyed by slug.
@returns the index and each configuration page, keyed by path
*/
export function buildConfigurationPages(guideTitles: Record<GuideSlug, string>): Map<string, ReferencePage> {
    const pages = new Map<string, ReferencePage>([
        [
            `${REFERENCE_FOLDERS.configurations}/index`,
            buildReferencePage(
                'Configurations',
                'Choose configurations by the files and tools they check.',
                'gspot selects configurations from the files of each scope. `gspot add <name>` and ' +
                    '`gspot remove <name>` change the selection, and `gspot list` shows it.\n' +
                    Object.entries(GROUP_LABELS)
                        .map(([group, title]) => {
                            const rows = CLI_REFERENCE.configurations
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
    for (const configuration of CLI_REFERENCE.configurations)
        pages.set(
            `${REFERENCE_FOLDERS.configurations}/${configuration.name}`,
            buildConfigurationPage(configuration, guideTitles),
        );
    return pages;
}
