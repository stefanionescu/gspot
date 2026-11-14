import { posix } from 'node:path';
import type { ReferencePage } from '#docs/types/pages.ts';
import type { Suppression } from '#docs/types/reference.ts';
import { DOCS_PATHS, CLI_REFERENCE, formatNameList, type CliReference } from '@gspothq/cli/reference';

import {
    formatText,
    formatTable,
    formatSection,
    buildReferencePage,
    formatConfigurationLink,
} from '#docs/reference/markdown.ts';
import {
    HELP_HEADING,
    CHECKS_HEADING,
    CHECKS_OPENING,
    PURPOSE_HEADING,
    CHECK_RUN_LABELS,
    TURN_OFF_HEADING,
    CHECK_FIX_MESSAGE,
    CHECK_NEEDS_LABELS,
    LINT_RULES_HEADING,
    REFUSED_FORM_LABEL,
    SUPPRESSIONS_CHECK,
    MINOR_HEADING_LEVEL,
    COMMENT_BLIND_ARGUMENTS,
    SUBSECTION_HEADING_LEVEL,
    SUPPRESSION_FORMS_HEADING,
    REFUSED_SUPPRESSION_MESSAGE,
} from '#docs/config/reference.ts';

function formatCheckRequirements(needs: CliReference['checks'][number]['needs']): string {
    const resources = needs.flatMap((need) => (need === 'project-code' ? [] : [CHECK_NEEDS_LABELS[need]]));
    return formatNameList([
        ...(needs.includes('project-code') ? ['loads your code'] : []),
        ...(resources.length === 0 ? [] : [`needs ${formatNameList(resources)}`]),
    ]);
}

function formatCheckRun(reference: CliReference['checks'][number]): string {
    const { check, programs, systems, needs } = reference;
    const [program] = programs;
    const run = [
        check.stage === 'manual'
            ? `Runs only when \`gspot check --only ${check.id}\` names it`
            : `Runs at the \`${check.stage}\` [stage](${DOCS_PATHS.stage})`,
        check.level === 'basic' ? '' : `only at the \`${check.level}\` [level](${DOCS_PATHS.levels})`,
        CHECK_RUN_LABELS[check.runs],
        program === undefined || check.id.includes(program) ? '' : `with ${program}`,
        systems === undefined ? '' : `on ${formatNameList(systems)}`,
    ]
        .filter(Boolean)
        .join(', ');
    const requirements = formatCheckRequirements(needs);
    return requirements === '' ? `${run}.` : `${run}, and ${requirements}.`;
}

function formatSuppressionComment(suppression: Suppression | undefined): string {
    if (suppression === undefined) return '';
    return suppression.forbidden === true
        ? REFUSED_SUPPRESSION_MESSAGE
        : `\n\nTo silence one place, write a comment such as:\n\n\`\`\`text\n${suppression.example ?? ''}\n\`\`\``;
}

function formatTurnOff(reference: CliReference['checks'][number]): string {
    const { check, turnOff, suppression } = reference;
    const commands = [
        ...(turnOff.paths === null ? [] : [turnOff.paths]),
        ...(turnOff.rule === undefined ? [] : [turnOff.rule]),
    ];
    const comment =
        check.command?.some((argument) => COMMENT_BLIND_ARGUMENTS.has(argument)) === true
            ? ''
            : formatSuppressionComment(suppression);
    return `\`\`\`text\n${commands.join('\n')}\n\`\`\`${comment}`;
}

function formatRuleTable(reference: CliReference['checks'][number]): string {
    if (reference.explanations === undefined) return '';
    const rules = Object.entries(reference.explanations);
    if (rules.length === 0) return '';
    return formatTable(
        ['Rule', CHECKS_HEADING, HELP_HEADING],
        rules.map(([name, explanation]) => [`\`${name}\``, explanation.description ?? '', explanation.fix ?? '']),
    );
}

export function formatCheckSection(reference: CliReference['checks'][number]): string {
    const { check } = reference;
    const facts = [
        formatCheckRun(reference),
        check.fix === undefined ? '' : CHECK_FIX_MESSAGE,
        check.when?.setting === undefined ? '' : `It skips until you set \`${check.when.setting}\`.`,
        check.when?.configuration === undefined
            ? ''
            : `It runs only in a scope that selects the \`${check.when.configuration}\` configuration.`,
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

export function buildCheckIndex(): ReferencePage {
    const { checks } = CLI_REFERENCE;
    return buildReferencePage(
        'Checks',
        undefined,
        CHECKS_OPENING +
            Object.entries(CLI_REFERENCE.groups)
                .map(([group, title]) => {
                    const groupChecks = checks.filter(({ configuration }) => configuration.group === group);
                    return formatSection(title, formatCheckTable(groupChecks));
                })
                .join(''),
    );
}

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
