import type { Tool } from '#cli/types/configurations.ts';
import { REFERENCE_FACTS, type readReferenceFacts } from './facts.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { WHOLE_SETTING_PLACEHOLDER } from '#cli/config/placeholders.ts';
import { getTool, getToolName } from '#cli/configurations/declared-tools.ts';
import type { GuideCheck, ReferencePage, ReferenceFacts } from '../types/reference.ts';
import { CHECK_RUN_LABELS, CHECK_NEEDS_LABELS, SUPPRESSIONS_CHECK } from '../config/reference.ts';
import { formatList, formatTable, formatSection, buildReferencePage, formatReferencePath } from './markdown.ts';

type Suppression = NonNullable<Tool['suppression']>;

const configurations = REFERENCE_FACTS.configurations;

/**
 * Name the tools a check runs; a built-in check runs none.
 *
 * @param check the declaration
 * @returns the display name, or nothing for a built-in check
 */
function formatToolNames(check: Check): string | undefined {
    const program = getToolName(check);
    if (program === undefined) return undefined;
    // A command taken from a setting names the setting, not the placeholder.
    const setting = WHOLE_SETTING_PLACEHOLDER.exec(program)?.groups?.['name'];
    const tool = setting === undefined ? program : `the command in \`${setting}\``;
    return check.other_tools === undefined ? tool : `${tool}, with ${formatList(check.other_tools)}`;
}

// The tool the check runs, and the build, service, or system it needs, each as one sentence when it applies.
function listCheckRequirements(check: Check): string[] {
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
function formatCheckFacts(check: Check, configuration: Configuration): string {
    const configurationName = configuration.name;
    const timing =
        check.stage === 'manual'
            ? `only when \`gspot check --only ${check.name}\` names it`
            : `at the \`${check.stage}\` [stage](/start/concepts/#stage)`;
    return [
        `Part of the [\`${configurationName}\`](${formatReferencePath('configurations', configurationName)}) configuration, at the \`${check.level}\` [level](/start/concepts/#levels). It runs ${timing}, ${CHECK_RUN_LABELS[check.runs]}.`,
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
function formatTurnOff(check: Check, suppressions: Map<string, Suppression>): string {
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
 * @param configuration the parsed configuration that declares it
 * @param suppressions the suppression form of each tool
 * @returns the page data and Markdown
 */
export function buildCheckPage(
    check: Check,
    configuration: Configuration,
    suppressions: Map<string, Suppression>,
): ReferencePage {
    const lines = [
        `${check.summary}\n\n${formatCheckFacts(check, configuration)}\n`,
        formatSection('Why', check.why),
        formatSection('What to do', check.help),
        formatSection('Example', check.example ?? ''),
        formatSection('Turn it off', formatTurnOff(check, suppressions)),
        formatSection(
            'Suppression forms',
            check.name === SUPPRESSIONS_CHECK
                ? formatTable(
                      ['Tool', 'Form'],
                      [...suppressions].map(([name, form]) => [
                          name,
                          form.forbidden === true ? 'Refused; use `gspot ignore`' : `\`${form.example ?? ''}\``,
                      ]),
                  )
                : '',
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
export function buildCheckIndex(checks: ReferenceFacts['checks'], groups: Record<string, string>): ReferencePage {
    return buildReferencePage(
        'Checks',
        `${String(checks.length)} checks declared by shipped configurations.`,
        'Each check ID is `<configuration>/<name>`. The [stage](/start/concepts/#stage) says when it runs, and the ' +
            '[level](/start/concepts/#levels) says which setting of `level` turns it on. ' +
            '`gspot explain <check>` shows its state in your repository.\n' +
            Object.entries(groups)
                .map(([group, title]) => {
                    const entries = checks.filter(({ configuration }) => configuration.group === group);
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
export function listSuppressions(configurations: Configuration[]): Map<string, Suppression> {
    return new Map(
        configurations.flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
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
    return REFERENCE_FACTS.checks
        .filter(({ configuration }) => configurations.includes(configuration.name))
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
export function formatCheckTable(checks: Check[]): string {
    return formatTable(
        ['Check', 'Stage', 'Level', 'What it does'],
        checks.map((check) => [
            `[\`${check.name}\`](${formatReferencePath('checks', check.name)})`,
            `\`${check.stage}\``,
            `\`${check.level}\``,
            check.summary,
        ]),
    );
}

type Configuration = ReturnType<typeof readReferenceFacts>['configurations'][number];

type Check = Configuration['checks'][number];

function listToolSystems(check: Check): string[] | undefined {
    const program = getToolName(check);
    const builds = program === undefined ? undefined : getTool(configurations, program).builds;
    if (check.operating_systems === undefined && builds === undefined) return undefined;
    return OPERATING_SYSTEMS.filter(
        ({ name }) =>
            (check.operating_systems?.includes(name) ?? true) &&
            (builds?.some((build) => build === name || build.startsWith(`${name}-`)) ?? true),
    ).map(({ label }) => label);
}
