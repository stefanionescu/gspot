import { section, referencePage } from './markdown.ts';
import type { ReferencePage } from '../types/reference.ts';
import { CHECK_RUN_LABELS, REFERENCE_FOLDERS } from '../config/reference.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';

function checkEnvironment(check: CheckDeclaration): string[] {
    const runs = CHECK_RUN_LABELS[check.runs];
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', toolLabel(check)],
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
 * @returns the page
 */
export function checkPage(check: CheckDeclaration, manifest: Manifest): ReferencePage {
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Details\n\n`,
        `- Configuration: [${manifest.configuration.name}](/reference/${REFERENCE_FOLDERS.configurations}/${manifest.configuration.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        ...checkEnvironment(check),
        section('Example', check.example ?? ''),
        check.stage === 'message'
            ? '\nThe commit-msg hook checks the message of each commit.\n'
            : `\nRun it with \`gspot check --only ${check.name}\`, and add an ignore with \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return referencePage(check.name, check.summary, lines.join(''));
}

/**
 * Name the tools a check runs, or gspot for a check implemented in the CLI.
 * @param check the declaration
 * @returns the display name
 */
export function toolLabel(check: CheckDeclaration): string {
    return typeof check.tool === 'object'
        ? Object.values(check.tool).join(', ')
        : (check.tool ?? check.command?.[0] ?? 'gspot');
}
