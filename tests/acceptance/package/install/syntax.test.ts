// Installs built packages from an isolated registry: syntax findings reach the JSON report and naming is opt-in.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/package.ts';
import type { InstalledConsumer } from '#tests/types/package.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { createConsumer } from '#tests/support/package/consumer.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/support/package/published.ts';

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
    const acceptedName = JSON.parse(renamed.stdout) as RunReport;
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
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.exitCode).toBe(1);
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
        const clean = JSON.parse(corrected.stdout) as RunReport;
        expect(clean.exitCode).toBe(0);
        expect(clean.skips).toStrictEqual([]);
        expect(clean.checks).toHaveLength(1);
        expect(clean.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'ok', files: 1, findings: [] });
        await expectInstalledNaming(installation);
    },
    RELEASE_TIMEOUT_MS,
);
