import { posix } from 'node:path';
import { CLI_REFERENCE } from '#cli/reference.ts';
import type { ReferencePage } from '#docs/types/pages.ts';
import type { Suppression, CliReference } from '#docs/types/reference.ts';

import {
    formatText,
    formatTable,
    formatSection,
    buildReferencePage,
    formatConfigurationLink,
} from '#docs/reference/markdown.ts';
import {
    HELP_HEADING,
    CHECKS_OPENING,
    PURPOSE_HEADING,
    CHECK_RUN_LABELS,
    BUILT_IN_MESSAGE,
    TURN_OFF_HEADING,
    CHECK_FIX_MESSAGE,
    CONJUNCTION_FORMAT,
    CHECK_NEEDS_LABELS,
    SUPPRESSIONS_CHECK,
    LINT_RULES_MESSAGE,
    LINT_RULES_HEADING,
    REFUSED_FORM_LABEL,
    MINOR_HEADING_LEVEL,
    SUBSECTION_HEADING_LEVEL,
    SUPPRESSION_FORMS_HEADING,
    REFUSED_SUPPRESSION_MESSAGE,
} from '#docs/config/reference.ts';

function listCheckRequirements(reference: CliReference['checks'][number]): string[] {
    const { programs, systems, needs } = reference;
    return [
        programs.length === 0 ? BUILT_IN_MESSAGE : `It runs ${CONJUNCTION_FORMAT.format(programs)}.`,
        needs.length === 0
            ? ''
            : `It needs ${CONJUNCTION_FORMAT.format(needs.map((need) => CHECK_NEEDS_LABELS[need]))}.`,
        systems === undefined ? '' : `It runs on ${CONJUNCTION_FORMAT.format(systems)}.`,
    ];
}

function formatSuppressionComment(suppression: Suppression | undefined): string {
    if (suppression === undefined) return '';
    return suppression.forbidden === true
        ? REFUSED_SUPPRESSION_MESSAGE
        : `\n\nTo silence one place, write a comment such as:\n\n\`\`\`text\n${suppression.example ?? ''}\n\`\`\``;
}

function formatTurnOff(reference: CliReference['checks'][number]): string {
    const { turnOff, suppression } = reference;
    const commands = [turnOff.paths, ...(turnOff.rule === undefined ? [] : [turnOff.rule])];
    const comment = formatSuppressionComment(suppression);
    return `Turn it off for some files${turnOff.rule === undefined ? '' : LINT_RULES_MESSAGE}, with a reason:\n\n\`\`\`text\n${commands.join('\n')}\n\`\`\`${comment}`;
}

function formatRuleTable(reference: CliReference['checks'][number]): string {
    if (reference.ruleDocs === undefined) return '';
    const rules = Object.entries(reference.ruleDocs);
    if (rules.length === 0) return '';
    return formatTable(
        ['Rule', 'Meaning', 'What to do'],
        rules.map(([name, docs]) => [`\`${name}\``, docs.description ?? '', docs.fix ?? '']),
    );
}

/**
Format the section of one check on the page of its configuration: where it runs, why it matters, what to do, and how
to turn it off. The check name without the configuration gives its heading and anchor.

@param reference the shipped check and its shared requirements
*/
export function formatCheckSection(reference: CliReference['checks'][number]): string {
    const { check } = reference;
    const timing =
        check.stage === 'manual'
            ? `only when \`gspot check --only ${check.id}\` names it`
            : `at the \`${check.stage}\` [stage](${CLI_REFERENCE.docs.stage})`;
    const facts = [
        `\`${check.id}\` runs ${timing}, ${CHECK_RUN_LABELS[check.runs]}, at the \`${check.level}\` [level](${CLI_REFERENCE.docs.levels}).`,
        ...listCheckRequirements(reference),
        check.fix === undefined ? '' : CHECK_FIX_MESSAGE,
        check.when?.setting === undefined ? '' : `It skips until you set \`${check.when.setting}\`.`,
    ];
    const sections = [
        formatSection('Why', formatText(check.why), MINOR_HEADING_LEVEL),
        formatSection(HELP_HEADING, formatText(check.help), MINOR_HEADING_LEVEL),
        formatSection('Example', formatText(check.example ?? ''), MINOR_HEADING_LEVEL),
        formatSection(LINT_RULES_HEADING, formatRuleTable(reference), MINOR_HEADING_LEVEL),
        formatSection(TURN_OFF_HEADING, formatTurnOff(reference), MINOR_HEADING_LEVEL),
        formatSection(
            SUPPRESSION_FORMS_HEADING,
            check.id === SUPPRESSIONS_CHECK
                ? formatTable(
                      ['Tool', 'Form'],
                      CLI_REFERENCE.suppressions.map(({ name, form }) => [
                          name,
                          form.forbidden === true ? REFUSED_FORM_LABEL : `\`${form.example ?? ''}\``,
                      ]),
                  )
                : '',
            MINOR_HEADING_LEVEL,
        ),
    ];
    return formatSection(
        `\`${posix.basename(check.id)}\``,
        `${formatText(check.summary)}\n\n${facts.filter(Boolean).join(' ')}\n${sections.join('')}`,
        SUBSECTION_HEADING_LEVEL,
    );
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
            Object.entries(CLI_REFERENCE.groups)
                .map(([group, title]) => {
                    const groupChecks = checks.filter(({ configuration }) => configuration.group === group);
                    return formatSection(title, formatCheckTable(groupChecks));
                })
                .join(''),
    );
}

/**
Format the checks table shared by guide pages and the check index.

@param checks the checks in display order
*/
export function formatCheckTable(checks: CliReference['checks']): string {
    const rows = checks.map(({ check, configuration }) => [
        formatConfigurationLink(configuration.name, check.id),
        `\`${check.stage}\``,
        `\`${check.level}\``,
        check.summary,
    ]);
    const header = ['Check', 'Stage', 'Level', PURPOSE_HEADING];
    return formatTable(header, rows);
}
