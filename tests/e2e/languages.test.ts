import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import type { Finding, RunReport } from '#cli/types/runs/check.ts';
import { PROSE_CHECK, SWIFT_CHECK } from '#tests/data/packed-install.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';
import type { PackedSandbox, CommandOptions } from '#tests/types/packages.ts';
import { setUpPackedSandbox, createPackedSandbox } from '#tests/setup/packed-sandbox.ts';

/**
 * Run the installed CLI on one sample and parse its report.
 *
 * @param installation the packed CLI to run.
 * @param options the sandbox folder and environment.
 * @param check the sample, its fix, and the findings to expect.
 * @param check.only the check to run.
 * @param check.path where the sample goes.
 * @param check.sample text that holds the finding.
 * @param check.findings what the report must hold.
 * @param check.corrected text without the finding.
 * @returns the process output and parsed report.
 */
async function runPackedCheck(
    installation: Pick<PackedSandbox, 'command'>,
    options: CommandOptions,
    check: { only: string; path: string; sample: string; findings: readonly Partial<Finding>[]; corrected: string },
) {
    const commandArguments = [...installation.command, 'check', check.path, '--only', check.only, '--json'];
    await writeFile(join(options.cwd, check.path), check.sample);
    const failed = await runCommand(commandArguments, options);
    const report = JSON.parse(failed.stdout) as RunReport;
    await writeFile(join(options.cwd, check.path), check.corrected);
    const passed = await runCommand(commandArguments, options);
    const accepted = JSON.parse(passed.stdout) as RunReport;
    return { failed: { ...failed, report }, passed: { ...passed, report: accepted } };
}
// Install the configurations and write their project vocabulary.
async function prepareLanguages(installation: PackedSandbox): Promise<void> {
    const { command, onlineOptions } = installation;
    await writeFile(join(installation.root, 'entry.py'), 'answer = "example"\n');
    await createFileTree(installation.root, {
        'broken.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': '# Guide\n\nRead the guide.\n',
    });
    await setUpPackedSandbox(installation, { cwd: installation.root, configurations: ['bash', 'python', 'swift'] });
    const vocabulary = await runCommand(
        [
            ...command,
            'set',
            'allowed_words',
            'NebulaConfiguration',
            '--reason',
            'NebulaConfiguration is the project name.',
        ],
        onlineOptions,
    );
    expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
}

// After install, gspot finds and parses SQL without the dependencies of this checkout.
async function assertInstalledSql(installation: PackedSandbox): Promise<void> {
    const { root, command, offlineOptions, onlineOptions } = installation;
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const listed = await runCommand([...command, 'list', '--json'], offlineOptions);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const available = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(available.available.some((configuration) => configuration.name === 'sql')).toBe(true);
    const inspected = await runCommand([...command, 'doctor', '--json'], offlineOptions);
    const report = JSON.parse(inspected.stdout) as DoctorReport;
    expect(inspected.code, inspected.stdout + inspected.stderr).toBe(report.exitCode);
    expect(report.suggestions.detected.find((configuration) => configuration.configuration === 'sql')?.command).toBe(
        'gspot add sql',
    );
    const added = await runCommand([...command, 'add', 'sql'], onlineOptions);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const configured = await runCommand([...command, 'set', 'tools.sqlfluff.dialect', 'postgres'], onlineOptions);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const installed = await runCommand([...command, 'install'], onlineOptions);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(root, 'query.sql'), 'SELECT FROM;\n');
    const failed = await runCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/sqlfluff', '--json'],
        offlineOptions,
    );
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = JSON.parse(failed.stdout) as RunReport;
    expect(failedReport.skips).toStrictEqual([]);
    expect(failedReport.checks).toMatchObject([{ check: 'sql/sqlfluff', status: 'failed', fileCount: 1 }]);
    expect(failedReport.checks[0]!.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'query.sql', line: 1, rule: 'PRS' },
    ]);
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const sql = await runCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/sqlfluff', '--json'],
        offlineOptions,
    );
    expect(sql.code, sql.stdout + sql.stderr).toBe(0);
    const sqlReport = JSON.parse(sql.stdout) as RunReport;
    expect(sqlReport.skips).toStrictEqual([]);
    expect(sqlReport.checks).toHaveLength(1);
    expect(sqlReport.checks[0]).toMatchObject({
        check: 'sql/sqlfluff',
        status: 'passed',
        fileCount: 1,
        findings: [],
    });
}

test('a packed install runs the pinned language tools, reports their findings, and passes after the fixes', async () => {
    await using installation = await createPackedSandbox();

    await prepareLanguages(installation);
    for (const check of [PROSE_CHECK, SWIFT_CHECK]) {
        if (check === SWIFT_CHECK) {
            const level = await runCommand(
                [...installation.command, 'set', 'level', 'all'],
                installation.onlineOptions,
            );
            expect(level.code, level.stdout + level.stderr).toBe(0);
        }
        const { failed, passed } = await runPackedCheck(installation, installation.offlineOptions, check);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.skips).toStrictEqual([]);
        expect(failed.report.checks).toMatchObject([
            {
                check: check.only,
                status: 'failed',
                findings: check.findings.map((finding) => ({ file: check.path, ...finding })),
            },
        ]);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.skips).toStrictEqual([]);
        expect(passed.report.checks).toMatchObject([{ check: check.only, status: 'passed', findings: [] }]);
    }
    // The Vale word list exists at level all, which the Swift check turned on.
    const vocabulary = await readFile(
        join(installation.root, '.gspot/configurations/general/prose/styles/config/vocabularies/words/accept.txt'),
        'utf8',
    );
    const acceptedWords = vocabulary.trim().split('\n');
    expect(acceptedWords).toContain('NebulaConfiguration');
    expect(acceptedWords).toContain('Python');
    await assertInstalledSql(installation);
});
