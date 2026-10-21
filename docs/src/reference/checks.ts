import { readReferenceData } from '#cli/reference.ts';
import type { GuideCheck, ReferencePage } from '../types/reference.ts';
import { WHOLE_SETTING_PLACEHOLDER } from '#cli/config/configurations.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { getToolName, getToolDeclaration } from '#cli/configurations/tools.ts';
import { CHECK_RUN_LABELS, SUPPRESSIONS_CHECK, CHECK_NEEDS_LABELS } from '../config/reference.ts';

import {
    formatCode,
    formatList,
    escapeCell,
    formatTable,
    formatSection,
    buildReferencePage,
    formatReferencePath,
    formatReferenceLink,
} from './markdown.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];
type CheckDeclaration = Manifest['checks'][number];
type Suppression = NonNullable<Exclude<Manifest['tools'][number], string>['suppression']>;

const configurations = readReferenceData().configurations;

/**
 * Name the tools a check runs; a built-in check runs none.
 *
 * @param check the declaration
 * @returns the display name, or nothing for a built-in check
 */
function formatToolNames(check: CheckDeclaration): string | undefined {
    const program = getToolName(check);
    if (program === undefined) return undefined;
    // A command taken from a setting names the setting, not the placeholder.
    const setting = WHOLE_SETTING_PLACEHOLDER.exec(program)?.groups?.['name'];
    const tool = setting === undefined ? program : `the command in ${formatCode(setting)}`;
    return check.other_tools === undefined ? tool : `${tool}, with ${formatList(check.other_tools)}`;
}

// Every suppression form, for the check that reads them.
function formatSuppressionForms(suppressions: Map<string, Suppression>): string {
    return formatTable(
        ['Tool', 'Form'],
        [...suppressions].map(([name, form]) => [
            name,
            form.forbidden === true ? 'Refused; use `gspot ignore`' : formatCode(escapeCell(form.example ?? '')),
        ]),
    );
}

function listToolSystems(check: CheckDeclaration): string[] | undefined {
    const program = getToolName(check);
    const builds = program === undefined ? undefined : getToolDeclaration(configurations, program).builds;
    if (check.operating_systems === undefined && builds === undefined) return undefined;
    return OPERATING_SYSTEMS.filter(
        ({ name }) =>
            (check.operating_systems?.includes(name) ?? true) &&
            (builds?.some((build) => build === name || build.startsWith(`${name}-`)) ?? true),
    ).map(({ label }) => label);
}

// The tool the check runs, and the build, service, or system it needs, each as one sentence when it applies.
function listCheckRequirements(check: CheckDeclaration): string[] {
    const tools = formatToolNames(check);
    const systems = listToolSystems(check);
    const needs = check.needs?.map((need) => CHECK_NEEDS_LABELS[need]);
    return [
        tools === undefined ? 'gspot runs this check itself.' : `It runs ${tools}.`,
        needs === undefined ? '' : `It needs ${formatList(needs)}.`,
        systems === undefined ? '' : `It runs on ${formatList(systems)}.`,
    ];
}

// Where and when the check runs, in plain sentences, as Ruff opens a rule page.
function formatCheckFacts(check: CheckDeclaration, manifest: Manifest): string {
    const configuration = manifest.configuration.name;
    const timing =
        check.stage === 'manual'
            ? `only when ${formatCode('gspot check --only ' + check.name)} names it`
            : `at the ${formatCode(check.stage)} [stage](/start/concepts/#stage)`;
    return [
        `Part of the ${formatReferenceLink('configurations', configuration)} configuration, at the ${formatCode(check.level)} [level](/start/concepts/#levels). It runs ${timing}, ${CHECK_RUN_LABELS[check.runs]}.`,
        ...listCheckRequirements(check),
        check.fix === undefined ? '' : '`gspot check --fix` fixes what it can.',
        check.when?.setting === undefined ? '' : `It skips until you set ${formatCode(check.when.setting)}.`,
    ]
        .filter(Boolean)
        .join(' ');
}

// The comment that silences one finding of the tool, or the note that the tool takes none.
function formatSuppressionComment(form: Suppression | undefined): string {
    if (form === undefined) return '';
    if (form.forbidden === true) return '\n\nA suppression comment is refused; use `gspot ignore`.';
    return `\n\nTo silence one place, write a comment such as:\n\n\`\`\`text\n${form.example ?? ''}\n\`\`\``;
}

// How to turn the check off for some files or for one lint rule, and the comment that silences one place.
function formatTurnOff(check: CheckDeclaration, suppressions: Map<string, Suppression>): string {
    const commands = [
        `gspot ignore ${check.name} --paths "<glob>" --reason "<why>"`,
        ...(check.command === undefined ? [] : [`gspot ignore ${check.name} --rule <rule> --reason "<why>"`]),
    ];
    const program = getToolName(check);
    const comment = formatSuppressionComment(program === undefined ? undefined : suppressions.get(program));
    return `Turn it off for some files${check.command === undefined ? '' : ', or one of its lint rules'}, with a reason:\n\n\`\`\`shell\n${commands.join('\n')}\n\`\`\`${comment}`;
}

/**
 * Build the reference page of one check: where it runs, why it matters, what to do, and how to turn it off.
 *
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
    const lines = [
        `${check.summary}\n\n${formatCheckFacts(check, manifest)}\n`,
        formatSection('Why', check.why),
        formatSection('What to do', check.help),
        formatSection('Example', check.example ?? ''),
        formatSection('Turn it off', formatTurnOff(check, suppressions)),
        formatSection(
            'Suppression forms',
            check.name === SUPPRESSIONS_CHECK ? formatSuppressionForms(suppressions) : '',
        ),
    ];
    return buildReferencePage(check.name, check.summary, lines.join(''));
}

/**
 * Build the check index: one table per group, each check linked to its page.
 *
 * @param checks every declaration, with the configuration that owns it
 * @param groups the title of each folder of configurations
 * @returns the index page
 */
export function buildCheckIndex(
    checks: ReturnType<typeof readReferenceData>['checks'],
    groups: Record<string, string>,
): ReferencePage {
    return buildReferencePage(
        'Checks',
        `${String(checks.length)} checks declared by shipped configurations.`,
        'Each check ID is `<configuration>/<name>`. The [stage](/start/concepts/#stage) says when it runs, and the ' +
            '[level](/start/concepts/#levels) says which setting of `level` turns it on. ' +
            '`gspot explain <check>` shows its state in your repository.\n' +
            Object.entries(groups)
                .map(([group, title]) => {
                    const entries = checks.filter(({ configuration }) => configuration.configuration.group === group);
                    return formatSection(title, formatCheckTable(entries.map(({ check }) => check)));
                })
                .join(''),
    );
}

/**
 * Read the suppression form of every shipped tool that has one.
 *
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

/**
 * List the checks of some configurations for a guide page, in the order their manifests declare them.
 *
 * @param configurations the configuration names
 * @returns one row per check
 */
export function listGuideChecks(configurations: string[]): GuideCheck[] {
    return readReferenceData()
        .checks.filter(({ configuration }) => configurations.includes(configuration.configuration.name))
        .map(({ check }) => ({
            name: check.name,
            link: formatReferencePath('checks', check.name),
            stage: check.stage,
            summary: check.summary,
        }));
}

/**
 * Format the check rows shared by indexes and configuration pages.
 *
 * @param checks the declared checks in display order.
 * @returns the Markdown table, or nothing for no checks.
 */
export function formatCheckTable(checks: CheckDeclaration[]): string {
    return formatTable(
        ['Check', 'Stage', 'Level', 'What it does'],
        checks.map((check) => [
            formatReferenceLink('checks', check.name),
            formatCode(check.stage),
            formatCode(check.level),
            escapeCell(check.summary),
        ]),
    );
}
