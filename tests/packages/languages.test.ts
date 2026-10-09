// One consumer installs packed packages, reports findings, and passes after fixes.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { runTestCommand } from '#tests/harness/command.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';
import { PROSE_CHECK, SWIFT_CHECK } from '#tests/config/packages/languages.ts';
import { createConsumer, runPackageCheck, initializeConsumer, getPublishedRelease } from '#tests/harness/consumer.ts';

const release = getPublishedRelease();

// Prepare the installed consumer and its project vocabulary before observing native checks.
async function prepareLanguages(installation: Consumer): Promise<void> {
    const { command, onlineOptions } = installation;
    await writeFile(join(installation.root, 'entry.py'), 'answer = "example"\n');
    await createFileTree(installation.root, {
        'broken.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': '# Guide\n\nRead the guide.\n',
    });
    await initializeConsumer(release, installation);
    const vocabulary = await runTestCommand(
        [
            ...command,
            'set',
            'words',
            '{"NebulaConfiguration":"Reviewed project name."}',
            '--reason',
            'NebulaConfiguration is the project name.',
        ],
        onlineOptions,
    );
    expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
}

// SQL discovery and its embedded parser work after installation without checkout dependencies.
async function expectInstalledSql(installation: Consumer): Promise<void> {
    const { root, command, offlineOptions, onlineOptions } = installation;
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const listed = await runTestCommand([...command, 'list', '--json'], offlineOptions);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const available = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(available.available.some((configuration) => configuration.name === 'sql')).toBe(true);
    const inspected = await runTestCommand([...command, 'doctor', '--json'], offlineOptions);
    const report = JSON.parse(inspected.stdout) as DoctorReport;
    expect(inspected.code, inspected.stdout + inspected.stderr).toBe(report.exitCode);
    expect(report.suggestions.detected.find((configuration) => configuration.configuration === 'sql')?.command).toBe(
        'gspot add sql',
    );
    const added = await runTestCommand([...command, 'add', 'sql'], onlineOptions);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const configured = await runTestCommand([...command, 'set', 'tools.sqlfluff.dialect', 'postgres'], onlineOptions);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    await writeFile(join(root, 'query.sql'), 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n');
    const failed = await runTestCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/trivial-functions', '--json'],
        offlineOptions,
    );
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = JSON.parse(failed.stdout) as RunReport;
    expect(failedReport.skips).toStrictEqual([]);
    expect(failedReport.checks).toMatchObject([{ check: 'sql/trivial-functions', status: 'failed', fileCount: 1 }]);
    expect(failedReport.checks[0]!.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'query.sql', line: 1, rule: 'trivial-function' },
        { file: 'query.sql', line: 1, rule: 'trivial-file' },
    ]);
    expect(await readFile(join(root, 'query.sql'), 'utf8')).toBe(
        'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
    );
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const sql = await runTestCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/trivial-functions', '--json'],
        offlineOptions,
    );
    expect(sql.code, sql.stdout + sql.stderr).toBe(0);
    const sqlReport = JSON.parse(sql.stdout) as RunReport;
    expect(sqlReport.skips).toStrictEqual([]);
    expect(sqlReport.checks).toHaveLength(1);
    expect(sqlReport.checks[0]).toMatchObject({
        check: 'sql/trivial-functions',
        status: 'passed',
        fileCount: 1,
        findings: [],
    });
}

test('one installed consumer runs the pinned language tools against samples and fixes', async () => {
    await using installation = await createConsumer(release.registry, release.version);

    await prepareLanguages(installation);
    for (const check of [PROSE_CHECK, SWIFT_CHECK]) {
        if (check === SWIFT_CHECK) {
            const level = await runTestCommand(
                [...installation.command, 'set', 'level', 'all'],
                installation.onlineOptions,
            );
            expect(level.code, level.stdout + level.stderr).toBe(0);
        }
        const { failed, fixed, passed } = await runPackageCheck(installation, installation.offlineOptions, check);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.skips).toStrictEqual([]);
        expect(failed.report.checks).toMatchObject([
            {
                check: check.only,
                status: 'failed',
                findings: check.findings.map((finding) => ({ file: check.path, ...finding })),
            },
        ]);
        expect(fixed).toBeUndefined();
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.skips).toStrictEqual([]);
        expect(passed.report.checks).toMatchObject([{ check: check.only, status: 'passed', findings: [] }]);
        if (check === PROSE_CHECK) {
            const vocabulary = await readFile(
                join(installation.root, '.gspot/config/vale/styles/config/vocabularies/words/accept.txt'),
                'utf8',
            );
            const acceptedWords = vocabulary.trim().split('\n');
            expect(acceptedWords).toContain('NebulaConfiguration');
            expect(acceptedWords).toContain('Python');
        }
    }
    await expectInstalledSql(installation);
});
