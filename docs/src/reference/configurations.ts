import { posix } from 'node:path';
import { CLI_REFERENCE } from './cli.ts';
import { formatSettingLink } from './settings.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import type { Configuration } from '#cli/types/configurations.ts';
import { GROUP_LABELS } from '#cli/config/configurations/names.ts';
import type { GuideSlug, ReferencePage } from '../types/reference.ts';
import { findToolProjectPackage } from '#cli/configurations/tools.ts';
import { SETTINGS_BY_CONFIGURATION } from '#cli/settings/available.ts';
import { formatTable, formatSection, buildReferencePage } from './markdown.ts';

import {
    SETS_HEADING,
    REFERENCE_PATH,
    CHECKS_HEADING,
    PURPOSE_HEADING,
    ALL_FILES_LABEL,
    DETECTION_LABELS,
    SELECTED_HEADING,
    DEFAULTS_HEADING,
    REFERENCE_FOLDERS,
    RULES_OFF_HEADING,
    RULE_FILE_HEADING,
    INSTALLED_HEADING,
    DISJUNCTION_FORMAT,
    CONJUNCTION_FORMAT,
    RULE_FILES_HEADING,
    LINT_RULES_HEADING,
    SELF_INSTALL_LABEL,
    CONDITION_SEPARATOR,
    CONFIGURATION_GUIDES,
    CONFIG_FILES_HEADING,
    IGNORED_PATHS_HEADING,
    CONFIGURATIONS_OPENING,
    TOOLS_VERSIONS_HEADING,
    SELECTED_IN_GIT_MESSAGE,
    ALWAYS_SELECTED_MESSAGE,
    CONFIGURATIONS_DESCRIPTION,
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

function formatRuleFiles(configuration: Configuration, paths: string[]): string {
    const rows = paths.map((path) => {
        const condition = configuration.rules[posix.basename(path)];
        if (condition === undefined) return [`\`${path}\``, 'Always'];
        const conditions = formatDetectionConditions(condition).join(' or ');
        return [`\`${path}\``, `The repository has ${conditions}${formatAbsentDependencies(condition)}.`];
    });
    return formatTable([RULE_FILE_HEADING, INSTALLED_HEADING], rows);
}

function formatLintRulesOff(configuration: Configuration): string {
    const rows = configuration.eslint.rules_off.map((exclusion) => [
        exclusion.rules.map((rule) => `\`${rule}\``).join(', '),
        exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? ALL_FILES_LABEL,
        exclusion.reason,
    ]);
    return formatTable([LINT_RULES_HEADING, 'Files', 'Why'], rows);
}

function formatSelection(configuration: Configuration): string {
    if (configuration.always_selected)
        return configuration.when?.git === true ? SELECTED_IN_GIT_MESSAGE : ALWAYS_SELECTED_MESSAGE;
    const conditions = formatDetectionConditions(configuration.detect);
    const selected =
        conditions.length === 0
            ? ''
            : `gspot selects it in a scope with ${conditions.join(CONDITION_SEPARATOR)}${formatAbsentDependencies(configuration.detect)}.`;
    const requiredBy = CLI_REFERENCE.configurations
        .filter((owner) => owner.requires.includes(configuration.name))
        .map(
            (owner) =>
                `[\`${owner.name}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS['configurations']}/${owner.name === '' ? '' : owner.name + '/'})`,
        )
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
            (findToolProjectPackage(tool) !== undefined ||
            (tool.system !== true && tool.installers['mise'] !== undefined)
                ? ''
                : SELF_INSTALL_LABEL),
    ]);
    const targets = [...new Set(configuration.configFiles.map((configFile) => `\`${configFile.target}\``))];
    const ignored = configuration.ignored_paths.map((path) => `\`${path}\``);
    return [
        [TOOLS_VERSIONS_HEADING, formatTable(['Tool', 'Version'], tools)],
        [CONFIG_FILES_HEADING, targets.length === 0 ? '' : `gspot writes ${CONJUNCTION_FORMAT.format(targets)}.`],
        [IGNORED_PATHS_HEADING, ignored.length === 0 ? '' : `${CONJUNCTION_FORMAT.format(ignored)}.`],
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
        formatSettingLink(setting.name),
        setting.description,
    ]);
    const ruleFiles = listRuleFiles(configuration).map(({ path }) => posix.join(GSPOT_PATHS.configurations, path));
    const sections: [string, string][] = [
        [
            'Checks',
            formatTable(
                ['Check', 'Stage', 'Level', PURPOSE_HEADING],
                configuration.checks.map((check) => [
                    `[\`${check.id}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS['checks']}/${check.id === '' ? '' : check.id + '/'})`,
                    `\`${check.stage}\``,
                    `\`${check.level}\``,
                    check.summary,
                ]),
            ),
        ],
        ['Settings', formatTable(['Setting', SETS_HEADING], settings)],
        [SELECTED_HEADING, selection],
        [RULES_OFF_HEADING, formatLintRulesOff(configuration)],
        [DEFAULTS_HEADING, formatTable(['Setting', 'Value'], defaults)],
        [RULE_FILES_HEADING, formatRuleFiles(configuration, ruleFiles)],
        ...listInstalledSections(configuration),
    ];
    const required = configuration.requires
        .map(
            (name) =>
                `[\`${name}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS['configurations']}/${name === '' ? '' : name + '/'})`,
        )
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
                CONFIGURATIONS_DESCRIPTION,
                CONFIGURATIONS_OPENING +
                    Object.entries(GROUP_LABELS)
                        .map(([group, title]) => {
                            const rows = CLI_REFERENCE.configurations
                                .filter((configuration) => configuration.group === group)
                                .map((configuration) => [
                                    `[\`${configuration.name}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS['configurations']}/${configuration.name === '' ? '' : configuration.name + '/'})`,
                                    configuration.description,
                                ]);
                            return formatSection(title, formatTable(['Configuration', CHECKS_HEADING], rows));
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
