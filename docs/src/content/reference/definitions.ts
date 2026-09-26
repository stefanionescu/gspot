import plugin from '#plugin/plugin.ts';
import type { ReferencePage } from '../../types/reference.ts';
import { bullets, cell, referencePage, section, table } from './page.ts';
import type { CheckSpec, Manifest } from '@gspot/cli/src/types/configurations.ts';

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
            const body = `Rule: \`gspot/${name}\`.\n\n${docs.summary}\n\n${selected}\n\n## Why\n\n${docs.why}\n\n## Resolve the finding\n\n${docs.fix}\n\n## Defect and correction\n\n${docs.example}\n\n## Options\n\nThe rule accepts options described by this JSON schema:\n\n\`\`\`json\n${JSON.stringify(rule.meta.schema, null, 2)}\n\`\`\`\n\nDefault options:\n\n\`\`\`json\n${JSON.stringify(rule.meta.defaultOptions ?? [], null, 2)}\n\`\`\`\n`;
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
export function configurationPage(manifest: Manifest): ReferencePage {
    const { configuration } = manifest;
    const tools = manifest.tools.map((tool) =>
        tool.version === undefined ? tool.name : `${tool.name} ${tool.version}`,
    );
    const targets = manifest.configs.map((config) =>
        config.needs === undefined
            ? `\`${config.target}\``
            : `\`${config.target}\` when the [${config.needs} configuration](/reference/configurations/${config.needs}/) is selected`,
    );
    const rules = Object.values(manifest.rule_files).flatMap((files) => files.map((file) => `\`${file}\``));
    const settings = manifest.settings.map((setting) => `\`${setting.name}\`: ${setting.summary}`);
    const requires = configuration.requires.map((id) => `\`${id}\``).join(', ');
    const opening = [
        `${configuration.description}\n\nKind: ${configuration.kind}.`,
        requires === '' ? '' : ` Requires: ${requires}.`,
        configuration.default ? ' Selected by default.' : '',
        '\n',
    ].join('');
    const body = [
        opening,
        section('Tools', bullets(tools)),
        section('Generated tool files', bullets(targets)),
        section('Untracked tool files', bullets(manifest.untracked.map((path) => `\`${path}\``))),
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
        section('Settings', bullets(settings)),
        section('Rule files', bullets(rules)),
    ].join('');
    return referencePage(configuration.title, configuration.description, body, `${manifest.dir}/manifest.toml`);
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
    const tool = check.tool ?? check.command?.[0];
    const command = `gspot check --stage ${check.stage} --only ${check.reported_by ?? check.name} --no-cache`;
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Where it runs\n\n`,
        `Check: \`${check.name}\`.\n\n- Configuration: [the ${configuration.configuration.name} configuration](/reference/configurations/${configuration.configuration.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        check.reported_by === undefined
            ? `- Scope: ${
                  {
                      once: 'one execution for the repository',
                      'per-scope': 'each selected scope, excluding files owned by child scopes',
                      'per-file-list': 'selected file lists under the applicable scope policy',
                  }[check.runs]
              }. See [scope configuration](/guides/scopes/).\n`
            : '- Scope: follows the reporting check.\n',
        tool === undefined ? '' : `- Tool: ${tool}\n`,
        check.platform === undefined ? '' : `- Platform selection: ${check.platform.join(', ')}\n`,
        check.requires === undefined ? '' : `- Prerequisite: ${check.requires}\n`,
        check.waits_for === undefined ? '' : `- Required setting: \`${check.waits_for}\`; skipped until configured.\n`,
        check.reported_by === undefined
            ? ''
            : `- Reported by: [\`${check.reported_by}\`](/reference/rules/${check.reported_by}/). This entry does not execute a separate check.\n`,
        section('Defect and correction', check.example),
        check.stage === 'message'
            ? '\n## Verify a correction\n\nThe installed commit-msg hook checks the proposed commit message. A reported defect prevents the commit. Correct the message and retry the commit. A missing tool or unreadable report does not establish a clean result.\n'
            : `\n## Verify a correction\n\nIn a configured repository that selects this configuration, run:\n\n\`\`\`shell\n${command}\n\`\`\`\n\nA reported defect exits 1. Apply the correction described above and rerun the same command. Successful execution exits 0. Missing required tools and execution or report failures exit 2. Check the report for skips: a skipped check has not verified its inputs.\n`,
        `\nRecord a path exception with a reason: \`gspot ignore ${check.reported_by ?? check.name} --paths <glob> --reason "<why>"\`.\n`,
        check.reported_by === undefined
            ? ''
            : '\nThis exception disables the reporting check for those paths, including its other diagnostics.\n',
    ];
    return referencePage(
        check.title ?? check.name,
        check.summary,
        lines.join(''),
        `${configuration.dir}/manifest.toml`,
    );
}

/**
 * The page that lists every engine with the checks it runs.
 * @param checks every check with the configuration that declares it, by name
 * @returns the page
 */
export function enginesPage(checks: Map<string, { check: CheckSpec; configuration: Manifest }>): ReferencePage {
    const byEngine = new Map<string, CheckSpec[]>();
    for (const { check } of checks.values()) {
        if (check.engine === undefined) continue;
        const list = byEngine.get(check.engine) ?? [];
        list.push(check);
        byEngine.set(check.engine, list);
    }
    const sections = [...byEngine]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(
            ([engine, list]) =>
                `## ${engine.charAt(0).toUpperCase()}${engine.slice(1)}

${table(
    ['Check', 'Stage', 'What it finds'],
    list.map((check) => [`[\`${check.name}\`](/reference/rules/${check.name}/)`, check.stage, cell(check.summary)]),
)}\n`,
        );
    return referencePage(
        'Engines',
        'The checks gspot runs itself, by engine: structure, naming, prose and integrity.',
        `gspot runs external tools for what they do well and its own engines for the rest. Each engine is a set of checks; every check explains itself on its own page.\n\n${sections.join('\n')}`,
        'packages/cli/src/execution/engines.ts',
    );
}
