import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import { installSandbox } from '#tests/setup/install.ts';
import { parseCheckReport } from '#tests/setup/run-gspot.ts';
import type { PackedSandbox } from '#tests/types/packages.ts';
import { runCheckSample } from '#tests/setup/sample-checks.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { createPackedSandbox } from '#tests/setup/packed-sandbox.ts';
import { PROSE_CHECK, SWIFT_CHECK } from '#tests/data/packed-install.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';

// Install the configurations and write their project vocabulary.
async function prepareLanguages(installation: PackedSandbox): Promise<void> {
    const { online } = installation;
    await createFileTree(installation.root, {
        'entry.py': 'answer = "example"\n',
        'broken.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': '# Guide\n\nRead the guide.\n',
    });
    await installSandbox(online, { configurations: ['bash', 'python', 'swift'] });
    const vocabulary = await online.run(
        installation.root,
        ['set', 'allowed_words', 'NebulaConfiguration', '--reason', 'NebulaConfiguration is the project name.'],
        online.environment,
    );
    expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
}

// After install, gspot finds and parses SQL without the dependencies of this checkout.
async function assertInstalledSql(installation: PackedSandbox): Promise<void> {
    const { root, offline, online } = installation;
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const listed = await offline.run(root, ['list', '--json'], offline.environment);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const available = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(available.available.some((configuration) => configuration.name === 'sql')).toBe(true);
    const inspected = await offline.run(root, ['doctor', '--json'], offline.environment);
    const report = JSON.parse(inspected.stdout) as DoctorReport;
    expect(inspected.code, inspected.stdout + inspected.stderr).toBe(report.exitCode);
    expect(report.suggestions.detected.find((configuration) => configuration.configuration === 'sql')?.command).toBe(
        'gspot add sql',
    );
    const added = await online.run(root, ['add', 'sql'], online.environment);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const configured = await online.run(root, ['set', 'tools.sqlfluff.dialect', 'postgres'], online.environment);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    const installed = await online.run(root, ['install'], online.environment);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await writeFile(join(root, 'query.sql'), 'SELECT FROM;\n');
    const failed = parseCheckReport(
        await offline.run(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'], offline.environment),
    );
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    const failedReport = failed.report;
    expect(failedReport.checks).toMatchObject([{ check: 'sql/sqlfluff', status: 'failed', fileCount: 1 }]);
    expect(failedReport.checks[0]!.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual([
        { file: 'query.sql', line: 1, rule: 'PRS' },
    ]);
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const sql = parseCheckReport(
        await offline.run(root, ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'], offline.environment),
    );
    expect(sql.code, sql.stdout + sql.stderr).toBe(0);
    const sqlReport = sql.report;
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
            const level = await installation.online.run(
                installation.root,
                ['set', 'level', 'all'],
                installation.online.environment,
            );
            expect(level.code, level.stdout + level.stderr).toBe(0);
        }
        const { failed, passed } = await runCheckSample(installation.offline, check, { configurations: [], files: {} });
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { check: check.check, status: 'failed', findings: [check.expected] },
        ]);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.checks).toMatchObject([{ check: check.check, status: 'passed', findings: [] }]);
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
