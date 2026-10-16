import { posix } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import type { ReferencePage } from '../types/reference.ts';
import { ruleFiles } from '#cli/configurations/manifests.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { configurationSettings } from '#cli/settings/view.ts';
import { cell, table, section, referencePage } from './markdown.ts';
import { DETECTION_LABELS, REFERENCE_FOLDERS } from '../config/reference.ts';

// Describe each detection value, including content expressions.
function detectionConditions(detect: Manifest['detect']): string[] {
    return Object.entries(detect).flatMap(([kind, patterns]) =>
        Array.isArray(patterns)
            ? patterns.map((pattern) => `${DETECTION_LABELS[kind as keyof typeof DETECTION_LABELS]} \`${pattern}\``)
            : Object.entries(patterns).map(([path, pattern]) => `file \`${path}\` matches \`${pattern}\``),
    );
}

// The configuration's rule files and the conditions that install them.
function ruleSelection(manifest: Manifest): string {
    return ruleFiles(manifest)
        .map(({ path }) => {
            const condition = manifest.rules[posix.basename(path)];
            if (condition === undefined) return `- \`${path}\``;
            const conditions = detectionConditions(condition);
            return `- \`${path}\` when the repository matches any of: ${conditions.join(', ')}.`;
        })
        .join('\n');
}

function ruleExclusions(manifest: Manifest): string {
    return manifest.eslint.rules_off
        .map((exclusion) => {
            const rules = exclusion.rules.map((rule) => `\`${rule}\``).join(', ');
            const files = exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'all files in the scope';
            return `${rules} for ${files}. ${exclusion.reason}`;
        })
        .map((item) => `- ${item}`)
        .join('\n');
}

function configurationChecks(manifest: Manifest): string {
    if (manifest.checks.length === 0)
        return 'This configuration adds tool files or rules and has no checks of its own.';
    const rows = manifest.checks.map((check) => {
        return [
            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
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
 * @param manifests the validated built-in configurations
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
            : `\`${config.target}\` when the [${config.when.configuration} configuration](/reference/${REFERENCE_FOLDERS.configurations}/${config.when.configuration}/) is selected`,
    );
    const selected = detectionConditions(manifest.detect)
        .map((condition) => `- ${condition}`)
        .join('\n');
    const requiredBy = manifests
        .filter((owner) => owner.configuration.requires.includes(configuration.name))
        .map((owner) => `\`${owner.configuration.name}\``)
        .join(', ');
    const selection = configuration.always_selected
        ? 'Always selected.'
        : [selected, requiredBy === '' ? '' : `Selected when required by: ${requiredBy}.`]
              .filter(Boolean)
              .join('\n\n') || `Select explicitly with \`gspot add ${configuration.name}\`.`;
    const guideFile = new URL(`configuration-guides/${configuration.name}.md`, import.meta.url);
    const guide = existsSync(guideFile) ? readFileSync(guideFile, 'utf8').split('\n').slice(1).join('\n') : '';
    const defaults = Object.entries(manifest.defaults).map(
        ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\``,
    );
    const hostTools = manifest.tools
        .filter((tool) => Object.keys(tool.installers).length === 0)
        .map((tool) => tool.name);
    const sections: [string, string][] = [
        ['Selected when', selection],
        ['Tools you install yourself', hostTools.join(', ')],
        ['Tools and versions', tools.map((item) => '- ' + item).join('\n')],
        ['Files gspot writes', targets.map((item) => '- ' + item).join('\n')],
        ['Kept out of Git', manifest.ignored_folders.map((path) => '- `' + path + '`').join('\n')],
        ['Checks', configurationChecks(manifest)],
        ['Details', guide],
        [
            'Settings',
            configurationSettings(manifest.configuration.name)
                .map((setting) => `- \`${setting.name}\`: ${setting.summary}`)
                .join('\n'),
        ],
        ['Defaults set for other configurations', defaults.map((item) => '- ' + item).join('\n')],
        ['Lint rules turned off', ruleExclusions(manifest)],
        ['Rules', ruleSelection(manifest)],
    ];
    const required = configuration.requires.map((id) => '`' + id + '`').join(', ');
    const opening = configuration.description + (required === '' ? '' : `\n\nRequires: ${required}.`);
    const body = opening + sections.map(([title, content]) => section(title, content)).join('');
    return referencePage(configuration.title, configuration.description, body);
}
