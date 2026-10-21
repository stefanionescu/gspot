import { posix } from 'node:path';
import { linkSetting } from './settings.ts';
import { formatCheckTable } from './checks.ts';
import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import { isInstalledByGspot } from '#cli/configurations/tools.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS, CONFIGURATION_GUIDES } from '../config/reference.ts';

import {
    formatCode,
    formatList,
    escapeCell,
    formatTable,
    formatSection,
    buildReferencePage,
    formatReferenceLink,
} from './markdown.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];

const DETECTION_LIST_FORMAT = new Intl.ListFormat('en', { type: 'disjunction' });

function formatCodeNames(names: string[]): string {
    return DETECTION_LIST_FORMAT.format(names.map((name) => formatCode(name)));
}

function linkConfigurations(names: string[]): string {
    return names.map((name) => formatReferenceLink('configurations', name)).join(', ');
}

// The conditions that select: every kind with patterns, apart from the dependencies that rule a selection out.
function formatDetectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) => {
        if (kind === 'absent_dependencies') return [];
        if (Array.isArray(patterns))
            return patterns.length === 0
                ? []
                : [`${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]} ${formatCodeNames(patterns)}`];
        return Object.entries(patterns).map(
            ([path, pattern]) => `file ${formatCode(path)} matches ${formatCode(pattern)}`,
        );
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
        if (condition === undefined) return [formatCode(path), 'Always'];
        const conditions = formatDetectionConditions(condition).join(' or ');
        return [
            formatCode(path),
            escapeCell(`The repository has ${conditions}${formatAbsentDependencies(condition)}.`),
        ];
    });
    return formatTable(['Rule file', 'Installed when'], rows);
}

function formatLintRulesOff(manifest: Manifest): string {
    const rows = manifest.eslint.rules_off.map((exclusion) => [
        exclusion.rules.map((rule) => formatCode(rule)).join(', '),
        exclusion.files?.map((path) => formatCode(path)).join(', ') ?? 'All files in the scope',
        escapeCell(exclusion.reason),
    ]);
    return formatTable(['Lint rules', 'Files', 'Why'], rows);
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
            .join(' ') || `Select explicitly with ${formatCode('gspot add ' + configuration.name)}.`
    );
}

// What gspot installs and writes for a configuration, and the folders it keeps out of Git.
function listInstalledSections(manifest: Manifest): [string, string][] {
    const tools = manifest.tools.map((tool) => [
        tool.name,
        (tool.version === undefined ? 'Any' : formatCode(tool.version)) +
            (isInstalledByGspot(tool) ? '' : ', install it yourself'),
    ]);
    // Two pointers can share one target, so each file appears once.
    const targets = [...new Set(manifest.toolFiles.map((toolFile) => formatCode(toolFile.target)))];
    const ignored = manifest.ignored_paths.map((path) => formatCode(path));
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
 * Build the reference page of a shipped configuration: how it gets selected, its settings, and its checks.
 *
 * @param manifest the parsed configuration
 * @param data everything the CLI exports for the reference
 * @param guideTitles the authored guide titles keyed by slug.
 * @returns the title, summary, and Markdown body
 */
function buildConfigurationPage(
    manifest: Manifest,
    data: ReturnType<typeof readReferenceData>,
    guideTitles: Map<string, string>,
): ReferencePage {
    const { configuration } = manifest;
    const selection = formatSelection(manifest, data);
    const defaults = Object.entries(manifest.defaults).map(([name, value]) => [
        formatCode(name),
        formatCode(JSON.stringify(value)),
    ]);
    const settings = (data.configurationSettings[manifest.configuration.name] ?? []).map((setting) => [
        linkSetting(data.schema, setting.name),
        escapeCell(setting.summary),
    ]);
    const sections: [string, string][] = [
        ['Checks', formatCheckTable(manifest.checks)],
        ['Settings', formatTable(['Setting', 'What it sets'], settings)],
        ['Selected when', selection],
        ['Lint rules turned off', formatLintRulesOff(manifest)],
        ['Defaults set for other configurations', formatTable(['Setting', 'Value'], defaults)],
        ['Rules for coding agents', formatRules(manifest, data.ruleFiles[manifest.configuration.name] ?? [])],
        ...listInstalledSections(manifest),
    ];
    const required = linkConfigurations(configuration.requires);
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
 * @param data everything the CLI exports for the reference
 * @param guideTitles the authored guide titles keyed by slug.
 * @returns the index and each configuration page, keyed by path
 */
export function buildConfigurationPages(
    data: ReturnType<typeof readReferenceData>,
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
                            const rows = data.configurations
                                .filter((manifest) => manifest.configuration.group === group)
                                .map(({ configuration }) => [
                                    formatReferenceLink('configurations', configuration.name),
                                    escapeCell(configuration.description),
                                ]);
                            return formatSection(title, formatTable(['Configuration', 'What it checks'], rows));
                        })
                        .join(''),
            ),
        ],
    ]);
    for (const manifest of data.configurations)
        pages.set(
            `${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}.md`,
            buildConfigurationPage(manifest, data, guideTitles),
        );
    return pages;
}
