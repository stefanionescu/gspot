import { posix } from 'node:path';
import plugin from '#plugin/plugin.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { kitFiles } from '@gspothq/cli/src/rules/assemble.ts';
import { cell, table, section, referencePage } from './page.ts';
import type { Manifest, CheckSpec } from '@gspothq/cli/src/types/kits.ts';

// The indentation of the JSON blocks a reference page shows.
const JSON_INDENT = 2;

// A rule file of the kit, with the condition that installs it when it has one.
function ruleSelection(manifest: Manifest, path: string): string {
    const condition = manifest.rules[posix.basename(path)];
    if (condition === undefined) return `\`${path}\``;
    const labels = {
        extensions: 'file extension',
        filenames: 'filename',
        dependencies: 'dependency',
        shebangs: 'script interpreter',
        tags: 'file tag',
        paths: 'file path',
        project_files: 'project file',
    };
    const conditions = Object.entries(condition).flatMap(([kind, patterns]) =>
        patterns.map((pattern) => `${labels[kind as keyof typeof labels]} \`${pattern}\``),
    );
    return `\`${path}\` when the repository matches any of: ${conditions.join(', ')}.`;
}

function ruleExclusions(manifest: Manifest): string {
    return manifest.rules_off
        .map((exclusion) => {
            const rules = exclusion.rules.map((rule) => `\`${rule}\``).join(', ');
            const files = exclusion.files?.map((path) => `\`${path}\``).join(', ') ?? 'all files in the scope';
            const condition =
                exclusion.when === undefined
                    ? ''
                    : ` when \`${exclusion.when.setting}\` is \`${JSON.stringify(exclusion.when.value)}\``;
            return `${rules} (${exclusion.tool}) for ${files}${condition}. ${exclusion.reason}`;
        })
        .map((item) => `- ${item}`)
        .join('\n');
}

function checkEnvironment(check: CheckSpec): string[] {
    const tool = check.tool ?? check.command?.[0];
    const runs = { once: 'once for the repository', scope: 'once per scope', files: 'per file' }[check.runs];
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', tool],
        ['Platforms', check.platforms?.join(', ')],
        ['Needs', check.needs?.join(', ')],
        [
            'Required setting',
            check.when?.setting === undefined ? undefined : `\`${check.when.setting}\`; skipped until it is set.`,
        ],
    ];
    return attributes.flatMap(([label, value]) => (value === undefined ? [] : [`- ${label}: ${value}\n`]));
}

/**
 * Read standalone plugin documentation from the rule definitions and actual configurations.
 * @returns generated pages by reference-relative path
 */
export function pluginReferencePages(): Map<string, ReferencePage> {
    return new Map(
        Object.entries(plugin.rules).map(([name, rule]) => {
            const docs = rule.meta.docs;
            if (docs === undefined) throw new Error(`Plugin rule ${name} has no documentation.`);
            if (typeof docs.example !== 'string' || docs.example.trim() === '')
                throw new Error(`Plugin rule ${name} has no example.`);
            const configurations = Object.entries(plugin.configs)
                .filter(([, configuration]) => configuration.rules[`gspot/${name}`] !== undefined)
                .map(([level]) => `\`${level}\``);
            const selected =
                configurations.length === 0
                    ? 'Select this rule explicitly for the files it governs.'
                    : `Enabled by ${configurations.join(' and ')}.`;
            const body = `Rule: \`gspot/${name}\`.\n\n${docs.summary}\n\n${selected}\n\n## Why\n\n${docs.why}\n\n## Resolve the finding\n\n${docs.fix}\n\n## Defect and correction\n\n${docs.example}\n\n## Options\n\nThe rule accepts options described by this JSON schema:\n\n\`\`\`json\n${JSON.stringify(rule.meta.schema, null, JSON_INDENT)}\n\`\`\`\n\nDefault options:\n\n\`\`\`json\n${JSON.stringify(rule.meta.defaultOptions ?? [], null, JSON_INDENT)}\n\`\`\`\n`;
            return [
                `plugin/${name}.md`,
                referencePage(docs.title, docs.summary, body, `packages/eslint-plugin/src/rules/${name}.ts`),
            ];
        }),
    );
}

/**
 * The reference page of one kit: its tools, targets, rule files, settings, and relations.
 * @param manifest the kit's manifest
 * @returns the page
 */
export function kitPage(manifest: Manifest): ReferencePage {
    const { kit: configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) =>
        config.when === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.when.kit} kit](/reference/kits/${config.when.kit}/) is selected`,
    );
    const rules = kitFiles(manifest).map((file) => ruleSelection(manifest, file.path));
    const settings = manifest.settings.map((setting) => `\`${setting.name}\`: ${setting.summary}`);
    const defaults = [
        ...Object.entries(manifest.defaults).map(([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\``),
        ...Object.entries(manifest.defaults_all).map(
            ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\` at level all`,
        ),
    ];
    const requires = configuration.requires.map((id) => `\`${id}\``).join(', ');
    const opening = [
        configuration.description,
        requires === '' ? '' : `\n\nRequires: ${requires}.`,
        configuration.auto ? ' Selected by default.' : '',
        '\n',
    ].join('');
    const body = [
        opening,
        section('Tools', tools.map((item) => `- ${item}`).join('\n')),
        section('Generated tool files', targets.map((item) => `- ${item}`).join('\n')),
        section(
            'Ignored tool files',
            manifest.ignored
                .map((path) => `\`${path}\``)
                .map((item) => `- ${item}`)
                .join('\n'),
        ),
        section(
            'Checks',
            table(
                ['Check', 'Stage', 'What it finds'],
                manifest.checks.map((check) => [
                    `[\`${check.name}\`](/reference/checks/${check.name}/)`,
                    check.stage,
                    cell(check.summary),
                ]),
            ),
        ),
        section('Settings', settings.map((item) => `- ${item}`).join('\n')),
        section('Defaults set for other kits', defaults.map((item) => `- ${item}`).join('\n')),
        section('Rule exclusions', ruleExclusions(manifest)),
        section('Rule files', rules.map((item) => `- ${item}`).join('\n')),
    ].join('');
    return referencePage(
        configuration.title,
        configuration.description,
        body,
        `packages/cli/${manifest.dir}/manifest.toml`,
    );
}

/**
 * The reference page of one check: why it runs, what to do, and where it runs.
 * @param check the check's manifest entry
 * @param manifest the manifest that declares the check
 * @returns the page
 */
export function checkPage(check: CheckSpec, manifest: Manifest): ReferencePage {
    if (typeof check.example !== 'string' || check.example.trim() === '')
        throw new Error(`Check ${check.name} has no example.`);
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Where it runs\n\n`,
        `- Kit: [${manifest.kit.name}](/reference/kits/${manifest.kit.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        ...checkEnvironment(check),
        section('Defect and correction', check.example),
        check.stage === 'message'
            ? '\nThe commit-msg hook checks the message of each commit.\n'
            : `\nRun it with \`gspot check --only ${check.name}\`, and record a path exception with \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return referencePage(
        check.title ?? check.name,
        check.summary,
        lines.join(''),
        `packages/cli/${manifest.dir}/manifest.toml`,
    );
}
