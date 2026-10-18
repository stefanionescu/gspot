import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { escapeCell, formatTable, formatSection, buildReferencePage } from './markdown.ts';

import {
    CHECK_RUN_LABELS,
    REFERENCE_FOLDERS,
    SUPPRESSIONS_CHECK,
    CHECK_NEEDS_LABELS,
    SETTING_PLACEHOLDER,
} from '../config/reference.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];
type CheckDeclaration = Manifest['checks'][number];
type Suppression = NonNullable<Exclude<Manifest['tools'][number], string>['suppression']>;

// The program a check starts: its tool, or the first word of its command.
function findCheckProgram(check: CheckDeclaration): string | undefined {
    return check.tool ?? check.command?.[0];
}

/**
 * Name the tools a check runs; a built-in check runs none.
 * @param check the declaration
 * @returns the display name, or nothing for a built-in check
 */
function formatToolNames(check: CheckDeclaration): string | undefined {
    const program = findCheckProgram(check);
    if (program === undefined) return undefined;
    // A command taken from a setting names the setting, not the placeholder.
    const setting = SETTING_PLACEHOLDER.exec(program)?.groups?.['setting'];
    return setting === undefined ? program : `the command in \`${setting}\``;
}

// How to suppress one finding of the tool the check runs.
function formatSuppressionLines(check: CheckDeclaration, suppressions: Map<string, Suppression>): string[] {
    const program = findCheckProgram(check);
    const form = program === undefined ? undefined : suppressions.get(program);
    if (form === undefined) return [];
    return form.forbidden === true
        ? ['- Suppressions: refused; use `gspot ignore`\n']
        : [`- Suppress one place: \`${form.example ?? ''}\`\n`];
}

// Every suppression form, for the check that reads them.
function formatSuppressionForms(suppressions: Map<string, Suppression>): string {
    return formatTable(
        ['Tool', 'Form'],
        [...suppressions].map(([name, form]) => [
            name,
            form.forbidden === true ? 'Refused; use `gspot ignore`' : `\`${escapeCell(form.example ?? '')}\``,
        ]),
    );
}

function formatCheckEnvironment(check: CheckDeclaration): string[] {
    const runs = CHECK_RUN_LABELS[check.runs];
    const tools = formatToolNames(check);
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', tools],
        ['Fixer', check.fix === undefined ? undefined : '`gspot check --fix`'],
        ['Operating systems', check.operating_systems?.join(', ')],
        ['Needs', check.needs?.map((need) => CHECK_NEEDS_LABELS[need]).join(', ')],
    ];
    return [
        ...attributes.flatMap(([label, value]) => (value === undefined ? [] : [`- ${label}: ${value}\n`])),
        ...(tools === undefined ? ['- Built-in check\n'] : []),
        ...(check.when?.setting === undefined ? [] : [`- Skipped while \`${check.when.setting}\` is empty.\n`]),
    ];
}

/**
 * Build the reference page of one check: why it matters, what to do, and where it runs.
 * @param check the record from the manifest
 * @param manifest the parsed configuration that declares it
 * @param suppressions the suppression form of each tool
 * @returns the page data and Markdown
 */
export function buildCheckPage(
    check: CheckDeclaration,
    manifest: Manifest,
    suppressions: Map<string, Suppression>,
): ReferencePage {
    const stage =
        check.stage === 'manual' ? `manual; runs only with \`gspot check --only ${check.name}\`` : check.stage;
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Details\n\n`,
        `- Configuration: [${manifest.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}/)\n- [Stage](/start/concepts/#stage): ${stage}\n- [Level](/start/concepts/#levels): ${check.level}\n`,
        ...formatCheckEnvironment(check),
        ...formatSuppressionLines(check, suppressions),
        formatSection('Example', check.example ?? ''),
        formatSection(
            'Suppression forms',
            check.name === SUPPRESSIONS_CHECK ? formatSuppressionForms(suppressions) : '',
        ),
    ];
    return buildReferencePage(check.name, check.summary, lines.join(''));
}

/**
 * Build the check index: one table per group, each check linked to its page.
 * @param checks every declaration, with the configuration that owns it
 * @param groups the title of each folder of configurations
 * @returns the index page
 */
export function buildCheckIndex(
    checks: ReturnType<typeof readReferenceData>['checks'],
    groups: Record<string, string>,
): ReferencePage {
    return buildReferencePage(
        'All checks',
        `${String(checks.length)} checks declared by shipped configurations.`,
        'Each check ID is `<configuration>/<name>`. The [stage](/start/concepts/#stage) says when it runs, and the ' +
            '[level](/start/concepts/#levels) says which setting of `level` turns it on. ' +
            '`gspot explain <check>` shows its state in your repository.\n' +
            Object.entries(groups)
                .map(([group, title]) => {
                    const rows = checks
                        .filter(({ configuration }) => configuration.configuration.group === group)
                        .map(({ check }) => [
                            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
                            `\`${check.stage}\``,
                            `\`${check.level}\``,
                        ]);
                    return formatSection(
                        title,
                        rows.length === 0 ? '' : formatTable(['Check', 'Stage', 'Level'], rows),
                    );
                })
                .join(''),
    );
}

/**
 * Read the suppression form of every shipped tool that has one.
 * @param configurations every shipped manifest
 * @returns the form of each tool, by tool name
 */
export function listSuppressions(configurations: Manifest[]): Map<string, Suppression> {
    return new Map(
        configurations.flatMap((manifest) =>
            manifest.tools.flatMap((tool) =>
                typeof tool === 'string' || tool.suppression === undefined
                    ? []
                    : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
}
