// The install configuration: a minimum release age, and the security scanner where the package manager has one.
import { join } from 'node:path';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { existsSync, readFileSync } from 'node:fs';
import type { Reporter } from '#types/integrity.ts';
import { LOCKFILES, SECONDS_PER_DAY } from '#config/integrity.ts';

const BUNFIG = 'bunfig.toml';
const DEFAULT_AGE_DAYS = 7;

function installTable(root: string): Record<string, unknown> | undefined {
    const path = join(root, BUNFIG);
    if (!existsSync(path)) return undefined;
    const parsed = Bun.TOML.parse(readFileSync(path, 'utf8')) as { install?: Record<string, unknown> };
    return parsed.install ?? {};
}

function ageFindings(report: Reporter, install: Record<string, unknown>, days: number): Finding[] {
    const seconds = install['minimumReleaseAge'];
    const wanted = days * SECONDS_PER_DAY;
    if (typeof seconds === 'number' && seconds >= wanted) return [];
    const found = typeof seconds === 'number' ? String(seconds) : 'nothing';
    return [
        report(
            BUNFIG,
            'release-age',
            `[install] minimumReleaseAge is ${found}; the policy asks for ${String(wanted)} seconds (${String(days)} days).`,
        ),
    ];
}

function scannerFindings(report: Reporter, install: Record<string, unknown>, scanner: string): Finding[] {
    if (scanner === '') return [];
    const security = install['security'] as { scanner?: unknown } | undefined;
    if (security?.scanner === scanner) return [];
    return [report(BUNFIG, 'security-scanner', `[install.security] scanner is not ${scanner}.`)];
}

/**
 * The findings of the install policy; it reads bunfig.toml when the repository installs through Bun.
 * @param input the engine input
 * @returns the findings
 */
export function installPolicy(input: EngineInput): Promise<Finding[]> {
    const isBun = input.session.repository.files.some(
        (file) => LOCKFILES[file.path.slice(file.path.lastIndexOf('/') + 1)] === 'bun',
    );
    if (!isBun) return Promise.resolve([]);
    const tool = input.view.tool('install');
    const days = (tool['min_release_age_days'] as number | undefined) ?? DEFAULT_AGE_DAYS;
    const scanner = (tool['security_scanner'] as string | undefined) ?? '';
    const report: Reporter = (file, rule, text) => ({
        check: input.spec.name,
        file,
        line: 1,
        rule,
        message: text,
        fixable: false,
    });
    const install = installTable(input.root);
    if (install === undefined)
        return Promise.resolve([report('bun.lock', 'release-age', `No ${BUNFIG} sets [install] minimumReleaseAge.`)]);
    return Promise.resolve([...ageFindings(report, install, days), ...scannerFindings(report, install, scanner)]);
}
