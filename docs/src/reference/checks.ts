import type { ReferencePage } from '../types/reference.ts';
import type { readReferenceData } from '#cli/reference.ts';
import { formatTable, formatSection, buildReferencePage } from './markdown.ts';
import { CHECK_RUN_LABELS, REFERENCE_FOLDERS, CHECK_NEEDS_LABELS, SETTING_PLACEHOLDER } from '../config/reference.ts';

type Manifest = ReturnType<typeof readReferenceData>['configurations'][number];
type CheckDeclaration = Manifest['checks'][number];

/**
 * Name the tools a check runs, or gspot for a built-in check.
 * @param check the declaration
 * @returns the display name
 */
function formatToolNames(check: CheckDeclaration): string {
    if (typeof check.tool === 'object') return Object.values(check.tool).join(', ');
    const program = check.tool ?? check.command?.[0] ?? 'gspot';
    // A command taken from a setting names the setting, not the placeholder.
    const setting = SETTING_PLACEHOLDER.exec(program)?.groups?.['setting'];
    return setting === undefined ? program : `the command in \`${setting}\``;
}

function formatCheckEnvironment(check: CheckDeclaration): string[] {
    const runs = CHECK_RUN_LABELS[check.runs];
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', formatToolNames(check)],
        ['Operating systems', check.operating_systems?.join(', ')],
        ['Needs', check.needs?.map((need) => CHECK_NEEDS_LABELS[need]).join(', ')],
    ];
    return [
        ...attributes.flatMap(([label, value]) => (value === undefined ? [] : [`- ${label}: ${value}\n`])),
        ...(check.when?.setting === undefined ? [] : [`- Skipped while \`${check.when.setting}\` is empty.\n`]),
    ];
}

/**
 * Build the reference page of one check: why it matters, what to do, and where it runs.
 * @param check the record from the manifest
 * @param manifest the parsed configuration that declares it
 * @returns the page data and Markdown
 */
export function buildCheckPage(check: CheckDeclaration, manifest: Manifest): ReferencePage {
    const stage =
        check.stage === 'manual' ? `manual; runs only with \`gspot check --only ${check.name}\`` : check.stage;
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Details\n\n`,
        `- Configuration: [${manifest.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}/)\n- [Stage](/start/concepts/#stage): ${stage}\n- [Level](/start/concepts/#levels): ${check.level}\n`,
        ...formatCheckEnvironment(check),
        formatSection('Example', check.example ?? ''),
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
        Object.entries(groups)
            .map(([group, title]) => {
                const rows = checks
                    .filter(({ configuration }) => configuration.configuration.group === group)
                    .map(({ check }) => [
                        `[\`${check.name}\`](/reference/${REFERENCE_FOLDERS.checks}/${check.name}/)`,
                        `\`${check.stage}\``,
                        `\`${check.level}\``,
                    ]);
                return formatSection(title, rows.length === 0 ? '' : formatTable(['Check', 'Stage', 'Level'], rows));
            })
            .join(''),
    );
}
