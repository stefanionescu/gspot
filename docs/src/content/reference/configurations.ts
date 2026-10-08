import { posix } from 'node:path';
import { DETECTION_LABELS } from '../../config/reference.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import type { Manifest } from '@gspothq/cli/src/types/configurations.ts';
import { configurationFiles } from '@gspothq/cli/src/configurations/declarations.ts';

// Describe each native detection value, including content expressions.
function detectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) =>
        Array.isArray(patterns)
            ? patterns.map((pattern) => `${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]} \`${pattern}\``)
            : Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``),
    );
}

// The configuration's rule files and the conditions that install them.
function ruleSelection(manifest: Manifest): string {
    return configurationFiles(manifest)
        .map(({ path }) => {
            const condition =
                manifest.agent_rules[
                    posix.relative(`${manifest.configuration.kind}/${manifest.configuration.name}`, path)
                ];
            if (condition === undefined) return `- \`${path}\``;
            const conditions = detectionConditions(condition);
            return `- \`${path}\` when the repository matches any of: ${conditions.join(', ')}.`;
        })
        .join('\n');
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
        return [`[\`${check.name}\`](/reference/checks/${check.name}/)`, check.stage, check.level, cell(check.summary)];
    });
    return table(['Check', 'Stage', 'Level', 'What it finds'], rows);
}

/**
 * Describe a built-in configuration from its selection, settings, and check owners.
 * @param manifest the validated configuration manifest
 * @param manifests the validated built-in catalog
 * @returns its public reference page
 */
export function configurationPage(manifest: Manifest, manifests: Manifest[]): ReferencePage {
    const { configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.toolFiles.map((config) =>
        config.when === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.when.configuration} configuration](/reference/configurations/${config.when.configuration}/) is selected`,
    );
    const selected = detectionConditions(manifest.detect)
        .map((condition) => `- ${condition}`)
        .join('\n');
    const requiredBy = manifests
        .filter((owner) => owner.configuration.requires.includes(configuration.name))
        .map((owner) => `\`${owner.configuration.name}\``)
        .join(', ');
    const selection = configuration.always_selected
        ? 'Selected by default. Tool requirements depend on applicable checks.'
        : [selected, requiredBy === '' ? '' : `Selected when required by: ${requiredBy}.`]
              .filter(Boolean)
              .join('\n\n') || `Select explicitly with \`gspot add ${configuration.name}\`.`;
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
    const sections: [string, string][] = [
        ['Selected when', selection],
        ['You install', hostTools.join(', ')],
        ['Declared tool pins', tools.map((item) => '- ' + item).join('\n')],
        ['Generated tool files', targets.map((item) => '- ' + item).join('\n')],
        ['Kept out of Git', manifest.ignored.map((path) => '- `' + path + '`').join('\n')],
        ['Checks', configurationChecks(manifest)],
        ['Details', configuration.notes ?? ''],
        ['Settings', manifest.settings.map((setting) => `- \`${setting.name}\`: ${setting.summary}`).join('\n')],
        ['Defaults set for other configurations', defaults.map((item) => '- ' + item).join('\n')],
        ['Rule exclusions', ruleExclusions(manifest)],
        ['Rules for coding agents', ruleSelection(manifest)],
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
