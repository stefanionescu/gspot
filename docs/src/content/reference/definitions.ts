import plugin from '#plugin/plugin.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { cell, table, section, referencePage } from './page.ts';
import type { Manifest, CheckSpec } from '@gspothq/cli/src/types/kits.ts';

// The indentation of the JSON blocks a reference page shows.
const JSON_INDENT = 2;

function guideSelection(file: Manifest['guides'][string][number]): string {
    if (file.when === undefined) return `\`${file.path}\``;
    const labels = {
        extensions: 'file extension',
        filenames: 'filename',
        dependencies: 'dependency',
        shebangs: 'script interpreter',
        tags: 'file tag',
        paths: 'file path',
        project_files: 'project file',
    };
    const conditions = Object.entries(file.when).flatMap(([kind, patterns]) =>
        patterns.map((pattern) => `${labels[kind as keyof typeof labels]} \`${pattern}\``),
    );
    return `\`${file.path}\` when the repository matches any of: ${conditions.join(', ')}.`;
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
    const attributes: [string, string | undefined][] = [
        ['Tool', tool],
        ['Platform selection', check.platforms?.join(', ')],
        ['Prerequisite', check.requires],
        [
            'Required setting',
            check.waits_for === undefined ? undefined : `\`${check.waits_for}\`; skipped until configured.`,
        ],
    ];
    return [
        `- Scope: ${
            {
                once: 'one execution for the repository',
                scope: 'each selected scope, excluding files owned by child scopes',
                files: 'selected file lists under the applicable scope policy',
            }[check.runs]
        }. See [scope configuration](/guides/scopes/).\n`,
        ...attributes.flatMap(([label, value]) => (value === undefined ? [] : [`- ${label}: ${value}\n`])),
    ];
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
 * The reference page of one configuration: its tools, targets, rule files, settings, and relations.
 * @param manifest the configuration's manifest
 * @returns the page
 */
export function kitPage(manifest: Manifest): ReferencePage {
    const { kit: configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) =>
        config.needs === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.needs} configuration](/reference/kits/${config.needs}/) is selected`,
    );
    const rules = Object.values(manifest.guides).flatMap((files) => files.map((file) => guideSelection(file)));
    const settings = manifest.settings.map((setting) => `\`${setting.name}\`: ${setting.summary}`);
    const defaults = [
        ...Object.entries(manifest.defaults).map(([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\``),
        ...Object.entries(manifest.defaults_all).map(
            ([name, value]) => `\`${name}\`: \`${JSON.stringify(value)}\` at level all`,
        ),
    ];
    const requires = configuration.requires.map((id) => `\`${id}\``).join(', ');
    const opening = [
        `${configuration.description}\n\nKind: ${configuration.kind}.`,
        requires === '' ? '' : ` Requires: ${requires}.`,
        configuration.auto ? ' Selected by default.' : '',
        '\n',
    ].join('');
    const body = [
        opening,
        section('Tools', tools.map((item) => `- ${item}`).join('\n')),
        section('Generated tool files', targets.map((item) => `- ${item}`).join('\n')),
        section(
            'Untracked tool files',
            manifest.untracked
                .map((path) => `\`${path}\``)
                .map((item) => `- ${item}`)
                .join('\n'),
        ),
        section(
            'Checks',
            table(
                ['Check', 'Stage', 'What it finds'],
                manifest.checks.map((check) => [
                    `[\`${check.name}\`](/reference/rules/${check.name}/)`,
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
 * @param configuration the manifest that declares the check
 * @returns the page
 */
export function rulePage(check: CheckSpec, configuration: Manifest): ReferencePage {
    if (typeof check.example !== 'string' || check.example.trim() === '')
        throw new Error(`Check ${check.name} has no example.`);
    const command = `gspot check --stage ${check.stage} --only ${check.name}`;
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Where it runs\n\n`,
        `Check: \`${check.name}\`.\n\n- Configuration: [the ${configuration.kit.name} configuration](/reference/kits/${configuration.kit.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        ...checkEnvironment(check),
        section('Defect and correction', check.example),
        check.stage === 'message'
            ? '\n## Verify a correction\n\nThe installed commit-msg hook checks the proposed commit message. A reported defect prevents the commit. Correct the message and retry the commit. A missing tool or unreadable report does not establish a clean result.\n'
            : `\n## Verify a correction\n\nIn a configured repository that selects this configuration, run:\n\n\`\`\`shell\n${command}\n\`\`\`\n\nA reported defect exits 1. Apply the correction described above and rerun the same command. Successful execution exits 0. Missing required tools and execution or report failures exit 2. Check the report for skips: a skipped check has not verified its inputs.\n`,
        `\nRecord a path exception with a reason: \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return referencePage(
        check.title ?? check.name,
        check.summary,
        lines.join(''),
        `packages/cli/${configuration.dir}/manifest.toml`,
    );
}
