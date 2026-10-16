import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { CHECK_RUN_LABELS, REFERENCE_FOLDERS } from '../config/reference.ts';
import { formatSection, formatDefinitions, buildReferencePage } from './markdown.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];
type CheckDeclaration = Manifest['checks'][number];

/**
 * Name the tools a check runs, or gspot for a check implemented in the CLI.
 * @param check the declaration
 * @returns the display name
 */
function formatToolNames(check: CheckDeclaration): string {
    return typeof check.tool === 'object'
        ? Object.values(check.tool).join(', ')
        : (check.tool ?? check.command?.[0] ?? 'gspot');
}

function formatCheckEnvironment(check: CheckDeclaration): string[] {
    const runs = CHECK_RUN_LABELS[check.runs];
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', formatToolNames(check)],
        ['Operating systems', check.operating_systems?.join(', ')],
        ['Needs', check.needs?.join(', ')],
        [
            'Required setting',
            check.when?.setting === undefined ? undefined : `\`${check.when.setting}\`; skipped until it is set.`,
        ],
    ];
    return attributes.flatMap(([label, value]) => (value === undefined ? [] : [`- ${label}: ${value}\n`]));
}

/**
 * The reference page of one check: why it runs, what to do, and where it runs.
 * @param check the check's manifest entry
 * @param manifest the manifest that declares the check
 * @returns collection metadata and Markdown instructions for the selected check.
 */
export function buildCheckPage(check: CheckDeclaration, manifest: Manifest): ReferencePage {
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Details\n\n`,
        `- Configuration: [${manifest.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        ...formatCheckEnvironment(check),
        formatSection('Example', check.example ?? ''),
        check.stage === 'message'
            ? '\nThe commit-msg hook checks the message of each commit.\n'
            : `\nRun it with \`gspot check --only ${check.name}\`, and add an ignore with \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return buildReferencePage(check.name, check.summary, lines.join(''));
}

/**
 * Group the check index by configuration group and configuration.
 * @param checks declared checks and their owners
 * @param groups configuration group labels
 * @returns the index page
 */
export function buildCheckIndex(
    checks: ReturnType<typeof readReferenceData>['checks'],
    groups: Record<string, string>,
): ReferencePage {
    return buildReferencePage(
        'Checks',
        `${String(checks.length)} checks declared by shipped configurations.`,
        Object.entries(groups)
            .map(([group, title]) =>
                formatSection(
                    title,
                    [
                        ...new Set(
                            checks
                                .filter(({ configuration }) => configuration.configuration.group === group)
                                .map(({ configuration }) => configuration.configuration.name),
                        ),
                    ]
                        .map(
                            (name) =>
                                `\n### ${name}\n\n` +
                                formatDefinitions(
                                    checks
                                        .filter(({ configuration }) => configuration.configuration.name === name)
                                        .map(({ check }) => [
                                            `[\`${check.name}\`](/reference/checks/${check.name}/)`,
                                            `Stage \`${check.stage}\`, level \`${check.level}\`. ${check.summary}`,
                                        ]),
                                ),
                        )
                        .join('\n'),
                ),
            )
            .join(''),
    );
}
