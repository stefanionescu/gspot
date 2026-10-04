import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { isRecord } from '#cli/platform/objects.ts';
import { readSource } from '#cli/platform/source.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { SECONDS_PER_DAY } from '#cli/config/generation/bunfig.ts';
import { parseBunInstallSettings } from '#cli/parsers/packages.ts';
import { BUNFIG } from '#cli/config/checks/general/dependencies.ts';
import { LOCKFILE_CLIENTS } from '#cli/config/repository/inventory.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';

function installTable(root: string): Record<string, unknown> | undefined {
    const path = join(root, BUNFIG);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    return parseBunInstallSettings(readSource(root, BUNFIG).toString('utf8'));
}

function ageFindings(input: EngineInput, table: Record<string, unknown>, days: number): Finding[] {
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

function scannerFindings(input: EngineInput, table: Record<string, unknown>, scanner: string): Finding[] {
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
 * @param input the engine input
 * @returns the findings
 */
export function bunReleaseAge(input: EngineInput): Finding[] {
    const isBun = input.files.some(
        (file) => !file.path.split('/').includes(DOT_GSPOT) && LOCKFILE_CLIENTS[posix.basename(file.path)] === 'bun',
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
