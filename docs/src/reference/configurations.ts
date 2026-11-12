import { posix } from 'node:path';

import { CLI_REFERENCE } from '#cli/reference.ts';
import type { CliReference } from '#cli/types/main.ts';
import {
    ALL_FILES_LABEL,
    ALWAYS_SELECTED_MESSAGE,
    CHECKS_HEADING,
    CONDITION_SEPARATOR,
    CONFIG_FILES_HEADING,
    CONFIGURATIONS_OPENING,
    CONJUNCTION_FORMAT,
    DEFAULTS_HEADING,
    DISJUNCTION_FORMAT,
    IGNORED_PATHS_HEADING,
    INSTALLED_HEADING,
    LINT_RULES_HEADING,
    REFERENCE_FOLDERS,
    RULE_FILE_HEADING,
    RULE_FILES_HEADING,
    RULES_OFF_HEADING,
    SELECTED_HEADING,
    SELF_INSTALL_LABEL,
    SETS_HEADING,
    TOOLS_VERSIONS_HEADING,
} from '#docs/config/reference.ts';
import { formatCheckSection } from '#docs/reference/checks.ts';
import {
    buildReferencePage,
    formatConfigurationLink,
    formatSection,
    formatTable,
    formatText,
} from '#docs/reference/markdown.ts';
import { formatSettingLink } from '#docs/reference/settings.ts';
import type { ConfigurationGuide, ReferencePage } from '#docs/types/pages.ts';

const LOCAL_FILES_MESSAGE = '`repository/local-files` reports a tracked file at these paths.';

function formatRuleFiles(configuration: CliReference['configurations'][number]): string {
    const rows = configuration.ruleFiles.map(({ path, conditions, exclusions }) => {
        const unless = exclusions.length === 0 ? '' : ', ' + exclusions.join(', ');
        return [
            `\`${path}\``,
            conditions.length === 0 ? 'Always' : `The repository has ${conditions.join(' or ')}${unless}.`,
        ];
    });
    return formatTable([RULE_FILE_HEADING, INSTALLED_HEADING], rows);
}

function formatLintRulesOff(configuration: CliReference['configurations'][number]): string {
    const exclusions: Array<{ rules: string[]; files?: string[] | undefined; reason: string }> = [
        ...configuration.eslint.rules_off,
        ...configuration.markdownlint.rules_off,
    ];
    const rows = exclusions.map((exclusion) => [
        exclusion.rules.map((rule) => `\`${rule}\``).join(', '),
        exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? ALL_FILES_LABEL,
        exclusion.reason,
    ]);
    return formatTable([LINT_RULES_HEADING, 'Files', 'Why'], rows);
}

function formatSelection(configuration: CliReference['configurations'][number]): string {
    if (configuration.always_selected) return ALWAYS_SELECTED_MESSAGE;
    const { conditions, exclusions, requiredBy } = configuration.selection;
    const unless = exclusions.length === 0 ? '' : ', ' + exclusions.join(', ');
    const selected = conditions.length === 0 ? '' : `A scope has ${conditions.join(CONDITION_SEPARATOR)}${unless}.`;
    const owners = DISJUNCTION_FORMAT.format(requiredBy.map((name) => formatConfigurationLink(name)));
    return (
        [selected, owners === '' ? '' : `Also when ${owners} requires it.`].filter(Boolean).join(' ') ||
        `You run \`gspot add ${configuration.name}\`.`
    );
}

function formatToolVersion(
    configuration: CliReference['configurations'][number],
    tool: CliReference['configurations'][number]['installedTools'][number],
): string {
    if (tool.version !== undefined) return `\`${tool.version}\``;
    const minimum = configuration.tools.find(({ name }) => name === tool.name)?.min_version;
    return minimum === undefined ? 'Any' : `\`${minimum}\` or later`;
}

function listWrittenFiles(configuration: CliReference['configurations'][number]): string[] {
    const pointers = configuration.configs.flatMap(({ pointer }) =>
        pointer === undefined ? [] : (pointer.folders ?? ['']).map((folder) => posix.join(folder, pointer.path)),
    );
    const targets = configuration.configs.map((config) => config.target);
    return [...new Set([...pointers, ...targets])].map((path) => `\`${path}\``);
}

function listInstalledSections(configuration: CliReference['configurations'][number]): Array<[string, string]> {
    const tools = configuration.installedTools.map((tool) => [
        tool.name,
        formatToolVersion(configuration, tool) + (tool.source === 'system' ? SELF_INSTALL_LABEL : ''),
    ]);
    const written = listWrittenFiles(configuration);
    const ignored = configuration.ignored_paths.map((path) => `\`${path}\``);
    return [
        [TOOLS_VERSIONS_HEADING, formatTable(['Tool', 'Version'], tools)],
        [CONFIG_FILES_HEADING, CONJUNCTION_FORMAT.format(written)],
        [
            IGNORED_PATHS_HEADING,
            ignored.length === 0 ? '' : `${CONJUNCTION_FORMAT.format(ignored)}. ${LOCAL_FILES_MESSAGE}`,
        ],
    ];
}

function formatConfigurationGuide(name: string, guides: Map<string, ConfigurationGuide>): string {
    const guide = guides.get(name);
    if (guide === undefined) return '';
    const { slug, title } = guide;
    return `Guide: [${title}](/${slug}/).`;
}

function buildConfigurationPage(
    configuration: CliReference['configurations'][number],
    guides: Map<string, ConfigurationGuide>,
): ReferencePage {
    const selection = formatSelection(configuration);
    const defaults = Object.entries(configuration.defaults).map(([name, value]) => [
        `\`${name}\``,
        `\`${JSON.stringify(value)}\``,
    ]);
    const settings = configuration.settings.map((setting) => [formatSettingLink(setting.name), setting.description]);

    const sections: Array<[string, string]> = [
        [SELECTED_HEADING, selection],
        [
            'Checks',
            CLI_REFERENCE.checks
                .filter(({ configuration: owner }) => owner.name === configuration.name)
                .map((reference) => formatCheckSection(reference))
                .join(''),
        ],
        ['Settings', formatTable(['Setting', SETS_HEADING], settings)],
        [RULES_OFF_HEADING, formatLintRulesOff(configuration)],
        [DEFAULTS_HEADING, formatTable(['Setting', 'Value'], defaults)],
        [RULE_FILES_HEADING, formatRuleFiles(configuration)],
        ...listInstalledSections(configuration),
    ];
    const required = configuration.requires.map((name) => formatConfigurationLink(name)).join(', ');
    const opening = [
        formatText(configuration.description),
        required === '' ? '' : `It requires ${required}.`,
        formatConfigurationGuide(configuration.name, guides),
    ]
        .filter(Boolean)
        .join(' ');
    const body = opening + sections.map(([title, content]) => formatSection(title, content)).join('');
    return buildReferencePage(configuration.name, configuration.description, body);
}

export function buildConfigurationPages(guides: Map<string, ConfigurationGuide>): Map<string, ReferencePage> {
    const alwaysSelected = CLI_REFERENCE.configurations
        .filter(({ always_selected }) => always_selected)
        .map(({ name }) => formatConfigurationLink(name));
    const groupSections = Object.entries(CLI_REFERENCE.groups).map(([group, title]) => {
        const rows = CLI_REFERENCE.configurations
            .filter((configuration) => configuration.group === group)
            .map((configuration) => [formatConfigurationLink(configuration.name), configuration.description]);
        return formatSection(title, formatTable(['Configuration', CHECKS_HEADING], rows));
    });
    const index = buildReferencePage(
        'Configurations',
        undefined,
        CONFIGURATIONS_OPENING +
            formatSection('Core checks', CONJUNCTION_FORMAT.format(alwaysSelected)) +
            groupSections.join(''),
    );
    const pages = new Map<string, ReferencePage>([[`${REFERENCE_FOLDERS.configurations}/index`, index]]);
    for (const configuration of CLI_REFERENCE.configurations)
        pages.set(
            `${REFERENCE_FOLDERS.configurations}/${configuration.name}`,
            buildConfigurationPage(configuration, guides),
        );
    return pages;
}
