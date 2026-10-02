import { join } from 'node:path';
import { statSync } from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { SECONDS_PER_DAY } from '#cli/config/generation.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { LOCKFILES } from '#cli/config/repository/repository.ts';
import { BUNFIG, DEFAULT_AGE_DAYS } from '#cli/config/checks/repository.ts';

function installTable(root: string): Record<string, unknown> | undefined {
    const path = join(root, BUNFIG);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    const parsed = parseToml(readSource(root, BUNFIG).toString('utf8')) as { install?: Record<string, unknown> };
    return parsed.install ?? {};
}

function ageFindings(input: EngineInput, install: Record<string, unknown>, days: number): Finding[] {
    const seconds = install['minimumReleaseAge'];
    const wanted = days * SECONDS_PER_DAY;
    if (typeof seconds === 'number' && seconds >= wanted) return [];
    const found = typeof seconds === 'number' ? String(seconds) : 'nothing';
    return [
        findingAt(
            input,
            { file: BUNFIG, line: 1 },
            'release-age',
            `[install] minimumReleaseAge is ${found}; the policy asks for ${String(wanted)} seconds (${String(days)} days).`,
        ),
    ];
}

function scannerFindings(input: EngineInput, install: Record<string, unknown>, scanner: string): Finding[] {
    if (scanner === '') return [];
    const security = install['security'] as { scanner?: unknown } | undefined;
    if (security?.scanner === scanner) return [];
    return [
        findingAt(
            input,
            { file: BUNFIG, line: 1 },
            'security-scanner',
            `[install.security] scanner is not ${scanner}.`,
        ),
    ];
}

/**
 * The findings of the install policy; it reads bunfig.toml when the repository installs through Bun.
 * @param input the engine input
 * @returns the findings
 */
export function installPolicy(input: EngineInput): Finding[] {
    const isBun = input.files.some((file) => LOCKFILES[file.path.slice(file.path.lastIndexOf('/') + 1)] === 'bun');
    if (!isBun) return [];
    const tool = input.view.tool('install');
    const days = (tool['min_release_age_days'] as number | undefined) ?? DEFAULT_AGE_DAYS;
    const scanner = (tool['security_scanner'] as string | undefined) ?? '';
    const install = installTable(input.root);
    if (install === undefined)
        return [
            findingAt(
                input,
                { file: 'bun.lock', line: 1 },
                'release-age',
                `No ${BUNFIG} sets [install] minimumReleaseAge.`,
            ),
        ];
    return [...ageFindings(input, install, days), ...scannerFindings(input, install, scanner)];
}
