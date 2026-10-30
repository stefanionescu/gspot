import { posix } from 'node:path';
import { CLI_REFERENCE } from '#docs/reference/cli.ts';
import { GROUP_LABELS } from '#cli/config/manifests/names.ts';
import type { Check, Configuration } from '#cli/types/manifests.ts';
import { OPERATING_SYSTEMS } from '#cli/config/system/environment.ts';
import { getTool, getToolName, hasRuleOutput } from '#cli/manifests/tools.ts';
import { SETTING_ONLY_PLACEHOLDER } from '#cli/config/runs/command/placeholders.ts';
import type { GuideCheck, Suppression, ReferencePage } from '#docs/types/reference.ts';
import { formatTable, formatSection, buildReferencePage } from '#docs/reference/markdown.ts';

import {
    HELP_HEADING,
    REFERENCE_PATH,
    CHECKS_OPENING,
    PURPOSE_HEADING,
    CHECK_RUN_LABELS,
    BUILT_IN_MESSAGE,
    TURN_OFF_HEADING,
    REFERENCE_FOLDERS,
    CHECK_FIX_MESSAGE,
    CONJUNCTION_FORMAT,
    CHECK_NEEDS_LABELS,
    SUPPRESSIONS_CHECK,
    LINT_RULES_MESSAGE,
    REFUSED_FORM_LABEL,
    MINOR_HEADING_LEVEL,
    SUBSECTION_HEADING_LEVEL,
    SUPPRESSION_FORMS_HEADING,
    REFUSED_SUPPRESSION_MESSAGE,
} from '#docs/config/reference.ts';

function formatToolNames(check: Check): string | undefined {
    const program = getToolName(check);
    if (program === undefined) return undefined;
    const setting = SETTING_ONLY_PLACEHOLDER.exec(program)?.groups?.['name'];
    const tool = setting === undefined ? program : `the command in \`${setting}\``;
    return check.other_tools === undefined ? tool : `${tool}, with ${CONJUNCTION_FORMAT.format(check.other_tools)}`;
}

function listCheckRequirements(check: Check): string[] {
    const tools = formatToolNames(check);
    const systems = listToolSystems(check);
    const needs = check.needs?.map((need) => CHECK_NEEDS_LABELS[need]);
    return [
        tools === undefined ? BUILT_IN_MESSAGE : `It runs ${tools}.`,
        needs === undefined ? '' : `It needs ${CONJUNCTION_FORMAT.format(needs)}.`,
        systems === undefined ? '' : `It runs on ${CONJUNCTION_FORMAT.format(systems)}.`,
    ];
}

function formatSuppressionComment(suppression: Suppression | undefined): string {
    if (suppression === undefined) return '';
    return suppression.forbidden === true
        ? REFUSED_SUPPRESSION_MESSAGE
        : `\n\nTo silence one place, write a comment such as:\n\n\`\`\`text\n${suppression.example ?? ''}\n\`\`\``;
}

function formatTurnOff(check: Check, suppressions: Map<string, Suppression>): string {
    const commands = [
        `gspot ignore ${check.id} --paths "<glob>" --reason "<why>"`,
        ...(hasRuleOutput(check) ? [`gspot ignore ${check.id} --rule <rule> --reason "<why>"`] : []),
    ];
    const program = getToolName(check);
    const comment = formatSuppressionComment(program === undefined ? undefined : suppressions.get(program));
    return `Turn it off for some files${hasRuleOutput(check) ? LINT_RULES_MESSAGE : ''}, with a reason:\n\n\`\`\`shell\n${commands.join('\n')}\n\`\`\`${comment}`;
}

/**
Format the section of one check on the page of its configuration: where it runs, why it matters, what to do, and how
to turn it off. The check name without the configuration gives its heading and anchor.

@param check the record from the manifest
@param suppressions the suppression form of each tool
*/
export function formatCheckSection(check: Check, suppressions: Map<string, Suppression>): string {
    const timing =
        check.stage === 'manual'
            ? `only when \`gspot check --only ${check.id}\` names it`
            : `at the \`${check.stage}\` [stage](/start/concepts/#stage)`;
    const facts = [
        `\`${check.id}\` runs ${timing}, ${CHECK_RUN_LABELS[check.runs]}, at the \`${check.level}\` [level](/start/concepts/#levels).`,
        ...listCheckRequirements(check),
        check.fix === undefined ? '' : CHECK_FIX_MESSAGE,
        check.when?.setting === undefined ? '' : `It skips until you set \`${check.when.setting}\`.`,
    ];
    const sections = [
        formatSection('Why', check.why, MINOR_HEADING_LEVEL),
        formatSection(HELP_HEADING, check.help, MINOR_HEADING_LEVEL),
        formatSection('Example', check.example ?? '', MINOR_HEADING_LEVEL),
        formatSection(TURN_OFF_HEADING, formatTurnOff(check, suppressions), MINOR_HEADING_LEVEL),
        formatSection(
            SUPPRESSION_FORMS_HEADING,
            check.id === SUPPRESSIONS_CHECK
                ? formatTable(
                      ['Tool', 'Form'],
                      [...suppressions].map(([name, form]) => [
                          name,
                          form.forbidden === true ? REFUSED_FORM_LABEL : `\`${form.example ?? ''}\``,
                      ]),
                  )
                : '',
            MINOR_HEADING_LEVEL,
        ),
    ];
    const heading = `${'#'.repeat(SUBSECTION_HEADING_LEVEL)} \`${posix.basename(check.id)}\``;
    return `\n${heading}\n\n${check.summary}\n\n${facts.filter(Boolean).join(' ')}\n${sections.join('')}`;
}

/**
Build the check index: one table per group, each check linked to its section on the page of its configuration.
*/
export function buildCheckIndex(): ReferencePage {
    const { checks } = CLI_REFERENCE;
    return buildReferencePage(
        'Checks',
        `${String(checks.length)} checks declared by shipped configurations.`,
        CHECKS_OPENING +
            Object.entries(GROUP_LABELS)
                .map(([group, title]) => {
                    const groupChecks = checks.filter(({ configuration }) => configuration.group === group);
                    return formatSection(
                        title,
                        formatTable(
                            ['Check', 'Stage', 'Level', PURPOSE_HEADING],
                            groupChecks.map(({ check, configuration }) => [
                                `[\`${check.id}\`](${REFERENCE_PATH}${REFERENCE_FOLDERS.configurations}/${configuration.name}/#${posix.basename(check.id)})`,
                                `\`${check.stage}\``,
                                `\`${check.level}\``,
                                check.summary,
                            ]),
                        ),
                    );
                })
                .join(''),
    );
}

/**
List the suppression form of every shipped tool that has one.

@param configurations every shipped configuration
@returns the form of each tool, by tool name
*/
export function listSuppressions(configurations: Configuration[]): Map<string, Suppression> {
    return new Map(
        configurations.flatMap((configuration) =>
            configuration.tools.flatMap((tool) =>
                tool.suppression === undefined ? [] : [[tool.name, tool.suppression] as const],
            ),
        ),
    );
}

/**
List the checks of some configurations for a guide page, in the order their manifests declare them.

@param configurations the configurations that the guide covers
*/
export function listGuideChecks(configurations: string[]): GuideCheck[] {
    return CLI_REFERENCE.checks
        .filter(({ configuration }) => configurations.includes(configuration.name))
        .map(({ check, configuration }) => ({
            name: check.id,
            link: `${REFERENCE_PATH}${REFERENCE_FOLDERS.configurations}/${configuration.name}/#${posix.basename(check.id)}`,
            stage: check.stage,
            summary: check.summary,
        }));
}

function listToolSystems(check: Check): string[] | undefined {
    const program = getToolName(check);
    const builds = program === undefined ? undefined : getTool(CLI_REFERENCE.configurations, program).builds;
    if (builds === undefined && check.operating_systems === undefined) return undefined;
    return OPERATING_SYSTEMS.filter(
        ({ name }) =>
            (check.operating_systems?.includes(name) ?? true) &&
            (builds?.some((build) => build === name || build.startsWith(`${name}-`)) ?? true),
    ).map(({ label }) => label);
}
