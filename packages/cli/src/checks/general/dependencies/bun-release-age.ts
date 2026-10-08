import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { isRecord } from '#cli/platform/contracts.ts';
import { lockfileEntry } from '#cli/parsers/contracts.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { SECONDS_PER_DAY } from '#cli/config/platform/runtime.ts';
import { BUNFIG } from '#cli/config/checks/general/dependencies.ts';
import { parseBunInstallSettings } from '#cli/parsers/packages/public.ts';

function installTable(root: string): Record<string, unknown> | undefined {
    const path = join(root, BUNFIG);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    return parseBunInstallSettings(readSource(root, BUNFIG).toString('utf8'));
}

function ageFindings(input: CheckInput, table: Record<string, unknown>, days: number): Finding[] {
    const seconds = table['minimumReleaseAge'];
    const wanted = days * SECONDS_PER_DAY;
    if (typeof seconds === 'number' && seconds >= wanted) return [];
    const found = typeof seconds === 'number' ? String(seconds) : 'unset';
    return [
        findingAt(
            input,
            { file: posix.join(input.scope, BUNFIG), line: 1 },
            'release-age',
            `bunfig.toml sets [install] minimumReleaseAge to ${found}. Set it to ${String(wanted)} seconds (${String(days)} days).`,
        ),
    ];
}

function scannerFindings(input: CheckInput, table: Record<string, unknown>, scanner: string): Finding[] {
    if (scanner === '') return [];
    const security = table['security'];
    const configured = isRecord(security) ? security['scanner'] : undefined;
    if (configured === scanner) return [];
    return [
        findingAt(
            input,
            { file: posix.join(input.scope, BUNFIG), line: 1 },
            'security-scanner',
            `[install.security] scanner is ${typeof configured === 'string' ? JSON.stringify(configured) : 'unset'}. Set it to ${JSON.stringify(scanner)}.`,
        ),
    ];
}

/**
 * Reports Bun release-age and scanner settings in the scope's bunfig.toml.
 * @param input the check input
 * @returns the findings
 */
export function bunReleaseAge(input: CheckInput): Finding[] {
    const isBun = input.files.some(
        (file) =>
            !file.path.split('/').includes(DOT_GSPOT) && lockfileEntry(posix.basename(file.path))?.client === 'bun',
    );
    if (!isBun) return [];
    const { settings } = input.view;
    const days = settings['dependencies.min_release_age_days'] as number;
    const scanner = settings['dependencies.scanner'] as string;
    const table = installTable(input.scopeRoot);
    if (table === undefined)
        return [
            findingAt(
                input,
                { file: posix.join(input.scope, BUNFIG), line: 1 },
                'release-age',
                `No ${BUNFIG} sets [install] minimumReleaseAge.`,
            ),
        ];
    return [...ageFindings(input, table, days), ...scannerFindings(input, table, scanner)];
}
