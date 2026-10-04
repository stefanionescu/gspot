import { section, referencePage } from './page.ts';
import type { ReferencePage } from '../../types/reference.ts';
import type { Manifest, CheckSpec } from '@gspothq/cli/src/types/configurations.ts';

function checkEnvironment(check: CheckSpec): string[] {
    const tool = check.tool ?? check.command?.[0];
    const runs = { once: 'once for the repository', scope: 'once per scope', files: 'per file' }[check.runs];
    const attributes: [string, string | undefined][] = [
        ['Runs', runs],
        ['Tool', tool],
        ['Platforms', check.platforms?.join(', ')],
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
export function checkPage(check: CheckSpec, manifest: Manifest): ReferencePage {
    if (typeof check.example !== 'string' || check.example.trim() === '')
        throw new Error(`Check ${check.name} has no example.`);
    const lines = [
        `${check.summary}\n\n## Why\n\n${check.why}\n\n## What to do\n\n${check.help}\n\n## Details\n\n`,
        `- Configuration: [${manifest.configuration.name}](/reference/configurations/${manifest.configuration.name}/)\n- Stage: ${check.stage}\n- Level: ${check.level}\n`,
        ...checkEnvironment(check),
        section('Example', check.example),
        check.stage === 'message'
            ? '\nThe commit-msg hook checks the message of each commit.\n'
            : `\nRun it with \`gspot check --only ${check.name}\`, and record a path exception with \`gspot ignore ${check.name} --paths <glob> --reason "<why>"\`.\n`,
    ];
    return referencePage(check.name, check.summary, lines.join(''), `packages/cli/${manifest.dir}/manifest.toml`);
}
