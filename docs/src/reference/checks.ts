import { readReferenceData } from '#cli/reference.ts';
import type { GuideCheck, ReferencePage } from '../types/reference.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/operating-systems.ts';
import { formatList, escapeCell, formatTable, formatSection, buildReferencePage } from './markdown.ts';

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
 *
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

// The tool the check runs, and the build, service, or system it needs, each as one sentence when it applies.
function listCheckRequirements(check: CheckDeclaration): string[] {
    const tools = formatToolNames(check);
    const systems = check.operating_systems?.map(
        (name) => OPERATING_SYSTEMS.find((system) => system.name === name)?.label ?? name,
    );
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
            ? `only when \`gspot check --only ${check.name}\` names it`
            : `at the \`${check.stage}\` [stage](/start/concepts/#stage)`;
    return [
        `Part of the [\`${configuration}\`](/reference/${REFERENCE_FOLDERS.configurations}/${configuration}/) configuration, at the \`${check.level}\` [level](/start/concepts/#levels). It runs ${timing}, ${CHECK_RUN_LABELS[check.runs]}.`,
        ...listCheckRequirements(check),
        check.fix === undefined ? '' : '`gspot check --fix` fixes what it can.',
        check.when?.setting === undefined ? '' : `It skips until you set \`${check.when.setting}\`.`,
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
    const program = findCheckProgram(check);
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
                    const rows = checks
                        .filter(({ configuration }) => configuration.configuration.group === group)
                        .map(({ check }) => [
                            `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
                            `\`${check.stage}\``,
                            `\`${check.level}\``,
                            escapeCell(check.summary),
                        ]);
                    return formatSection(title, formatTable(['Check', 'Stage', 'Level', 'What it does'], rows));
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
            link: `/reference/${REFERENCE_FOLDERS.checks}/${check.name}/`,
            stage: check.stage,
            summary: check.summary,
        }));
}
