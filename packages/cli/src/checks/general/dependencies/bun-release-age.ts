import { z } from 'zod';
import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { isRecord } from '#cli/objects.ts';
import { parse as parseToml } from 'smol-toml';
import { findingAt } from '#cli/checks/finding.ts';
import { SECONDS_PER_DAY } from '#cli/config/units.ts';
import { readSource } from '#cli/system/file-reads.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { lockfileEntry } from '#cli/parsers/lockfiles.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { BUNFIG_FILE } from '#cli/config/generation/file-edits.ts';
import type { Finding, CheckInput } from '#cli/types/execution/check.ts';

function installTable(root: string): Record<string, unknown> | undefined {
    const path = join(root, BUNFIG_FILE);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    return bunInstallSchema.parse(parseToml(readSource(root, BUNFIG_FILE).toString('utf8'))).install;
}

function ageFindings(input: CheckInput, table: Record<string, unknown>, days: number): Finding[] {
    const seconds = table['minimumReleaseAge'];
    const wanted = days * SECONDS_PER_DAY;
    if (typeof seconds === 'number' && seconds >= wanted) return [];
    const found = typeof seconds === 'number' ? String(seconds) : 'unset';
    return [
        findingAt(
            input,
            { file: posix.join(input.selection.scope.path, BUNFIG_FILE), line: 1 },
            'release-age',
            `bunfig.toml sets [install] minimumReleaseAge to ${found}. Set it to ${String(wanted)} seconds (${String(days)} days).`,
        ),
    ];
}

function scannerFindings(input: CheckInput, table: Record<string, unknown>, scanner: string | undefined): Finding[] {
    if (scanner === undefined) return [];
    const security = table['security'];
    const configured = isRecord(security) ? security['scanner'] : undefined;
    if (configured === scanner) return [];
    return [
        findingAt(
            input,
            { file: posix.join(input.selection.scope.path, BUNFIG_FILE), line: 1 },
            'security-scanner',
            `[install.security] scanner is ${typeof configured === 'string' ? JSON.stringify(configured) : 'unset'}. Set it to ${JSON.stringify(scanner)}.`,
        ),
    ];
}

/** Native Bun installation options read by dependency settings checks. */
const bunInstallSchema = z.object({
    install: z.record(z.string(), z.unknown()).default({}),
} satisfies SchemaShape<{ install: Record<string, unknown> }>);

/**
 * Reports Bun release-age and scanner settings in the scope's bunfig.toml.
 * @param input the check input.
 * @returns the findings.
 */
export function bunReleaseAge(input: CheckInput): Finding[] {
    const isBun = input.files.some(
        (file) =>
            !file.path.split('/').includes(DOT_GSPOT) && lockfileEntry(posix.basename(file.path))?.client === 'bun',
    );
    if (!isBun) return [];
    const { min_release_age_days: days, scanner } = input.selection.view.options('dependencies');
    const table = installTable(join(input.root, input.selection.scope.path));
    if (table === undefined)
        return [
            findingAt(
                input,
                { file: posix.join(input.selection.scope.path, BUNFIG_FILE), line: 1 },
                'release-age',
                `No ${BUNFIG_FILE} sets [install] minimumReleaseAge.`,
            ),
        ];
    return [...ageFindings(input, table, days), ...scannerFindings(input, table, scanner)];
}
