// Installs built packages from an isolated registry: syntax findings reach the JSON report and preserve authored input.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { runTestCommand } from '#tests/harness/command.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { SYNTAX_FILES } from '#tests/config/packages/syntax.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/release.ts';

const release = getPublishedRelease();

test(
    'installed syntax diagnostics report a defect and accept its correction',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);

        const { root, command, offlineOptions } = installation;
        await createFileTree(root, SYNTAX_FILES);
        await initializeConsumer(release, installation);
        const checked = await runTestCommand([...command, 'check', '--only', 'bash/syntax', '--json'], offlineOptions);
        expect(checked.code, checked.stdout + checked.stderr).toBe(1);
        const report = JSON.parse(checked.stdout) as RunReport;
        expect(report.exitCode).toBe(1);
        expect(report.skips).toStrictEqual([]);
        expect(report.checks).toHaveLength(1);
        expect(report.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'failed', fileCount: 1 });
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
        writeFileSync(join(root, 'broken.sh'), 'echo example\n');
        const corrected = await runTestCommand(
            [...command, 'check', '--only', 'bash/syntax', '--json'],
            offlineOptions,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        const clean = JSON.parse(corrected.stdout) as RunReport;
        expect(clean.exitCode).toBe(0);
        expect(clean.skips).toStrictEqual([]);
        expect(clean.checks).toHaveLength(1);
        expect(clean.checks[0]).toMatchObject({ check: 'bash/syntax', status: 'passed', fileCount: 1, findings: [] });
        expect(readFileSync(join(root, 'authored.txt'), 'utf8')).toBe('Preserve this authored file.\n');
    },
    NATIVE_TEST_TIMEOUT_MS,
);
