// Installs built packages from an isolated registry: syntax findings reach every report format and naming is opt-in.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { reportSchema } from '#cli/execution/report.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/release.ts';
import type { InstalledConsumer } from '#tests/types/release.ts';
import { createConsumer } from '#tests/support/release/consumer.ts';
import type { SarifReport, CodeQualityReport } from '#tests/types/cli.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/support/release/published.ts';

const release = getPublishedRelease();

// Explicit naming selection runs in the installed consumer and preserves authored files.
async function expectInstalledNaming(installation: InstalledConsumer): Promise<void> {
    const { consumer, command, options } = installation;
    const optIn = await run([...command, 'set', 'extra_checks', 'naming/identifiers'], options);
    expect(optIn.code, optIn.stdout + optIn.stderr).toBe(0);
    writeFileSync(join(consumer, 'broken.sh'), 'command=example\n');
    const renamed = await run(
        [...command, 'check', 'broken.sh', '--only', 'naming/identifiers', '--no-cache', '--json'],
        options,
    );
    expect(renamed.code, renamed.stdout + renamed.stderr).toBe(0);
    const acceptedName = reportSchema.parse(JSON.parse(renamed.stdout));
    expect(acceptedName.skips).toStrictEqual([]);
    expect(acceptedName.checks).toHaveLength(1);
    expect(acceptedName.checks[0]).toMatchObject({
        check: 'naming/identifiers',
        status: 'ok',
        files: 1,
        findings: [],
    });
    expect(readFileSync(join(consumer, 'authored.txt'), 'utf8')).toBe('Preserve this authored file.\n');
}

test(
    'installed syntax diagnostics and naming accept corrected input',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);
        expect(installation.installed.code, installation.installed.stdout + installation.installed.stderr).toBe(0);
        const { consumer, command, options } = installation;
        await initializeConsumer(release, installation);
        const checked = await run([...command, 'check', '--only', 'bash/syntax', '--no-cache', '--json'], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = reportSchema.parse(JSON.parse(checked.stdout));
        expect(report.exitCode).toBe(1);
        expect(JSON.parse(readFileSync(join(consumer, '.gspot/reports/report.json'), 'utf8'))).toStrictEqual(report);
        const sarif = JSON.parse(readFileSync(join(consumer, '.gspot/reports/report.sarif'), 'utf8')) as SarifReport;
        expect(sarif.runs[0]!.invocations[0]!.executionSuccessful).toBe(true);
        const quality = JSON.parse(
            readFileSync(join(consumer, '.gspot/reports/report.codequality.json'), 'utf8'),
        ) as CodeQualityReport;
        expect(quality).toHaveLength(report.checks[0]?.findings.length ?? 0);
        expect(quality[0]).toMatchObject({
            check_name: 'bash/syntax',
            severity: 'major',
            location: { path: 'broken.sh', lines: { begin: 1 } },
        });
        expect(report.skips).toStrictEqual([]);
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'fail', files: 1 });
        expect(
            report.checks[0]!.findings.map(({ check, file, line, message: text }) => ({
                check,
                file,
                line,
                message: text,
            })),
        ).toStrictEqual([
            {
                check: 'bash/syntax',
                file: 'broken.sh',
                line: 1,
                message: "syntax error near unexpected token `then'",
            },
            { check: 'bash/syntax', file: 'broken.sh', line: 1, message: "`if then'" },
        ]);
        writeFileSync(join(consumer, 'broken.sh'), 'echo example\n');
        const corrected = await run([...command, 'check', '--only', 'bash/syntax', '--no-cache', '--json'], options);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const clean = reportSchema.parse(JSON.parse(corrected.stdout));
        expect(clean.exitCode).toBe(0);
        expect(
            JSON.parse(readFileSync(join(consumer, '.gspot/reports/report.codequality.json'), 'utf8')),
        ).toStrictEqual([]);
        expect(clean.skips).toStrictEqual([]);
        expect(clean.checks).toHaveLength(1);
        expect(clean.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'ok', files: 1, findings: [] });
        await expectInstalledNaming(installation);
    },
    RELEASE_TIMEOUT_MS,
);
