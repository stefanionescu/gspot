import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import type { UserProject } from '#tests/types/packages.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { findFileTarget } from '#tests/setup/cli/config-files.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';
import { PROSE_CHECK, SWIFT_CHECK } from '#tests/config/e2e/languages.ts';
import { createUserProject } from '#tests/setup/sandboxes/user-project.ts';
import { runCheckSample, expectedSummary, buildSampleSummary } from '#tests/setup/cli/samples.ts';

/** Run a sample of a check: it fails with the expected finding, and passes after its fix. */
async function assertSample(installation: UserProject, check: typeof PROSE_CHECK | typeof SWIFT_CHECK): Promise<void> {
    const result = await runCheckSample(installation.offline, check, { configurations: [], files: {} });
    expect(buildSampleSummary(result)).toStrictEqual(expectedSummary(check));
}

/** Install the configurations with the packed CLI, and add the project name to allowed_words. */
async function prepareLanguages(installation: UserProject): Promise<void> {
    const { online } = installation;
    await createFileTree(installation.root, {
        'entry.py': 'answer = "example"\n',
        'broken.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': '# Guide\n\nRead the guide.\n',
    });
    await initSandbox(online, { configurations: ['bash', 'python', 'swift'] });
    const vocabulary = await online.run(
        installation.root,
        [
            'set',
            'spelling.allowed_words',
            'NebulaConfiguration',
            '--reason',
            'NebulaConfiguration is the project name.',
        ],
        online.environment,
    );
    expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
}

test('gspot installed from npm runs Vale and the built-in Swift naming check, reports their findings, and passes after the fixes', async () => {
    await using installation = await createUserProject();
    await prepareLanguages(installation);
    await assertSample(installation, PROSE_CHECK);
    // The Swift naming check and the Vale word list run at level all.
    const level = await installation.online.run(
        installation.root,
        ['set', 'level', 'all'],
        installation.online.environment,
    );
    expect(level.code, level.stdout + level.stderr).toBe(0);
    await assertSample(installation, SWIFT_CHECK);
    const vocabulary = await readFile(
        join(installation.root, findFileTarget('prose', 'styles/config/vocabularies/words/accept.txt')),
        'utf8',
    );
    const acceptedWords = vocabulary.trim().split('\n');
    expect(acceptedWords).toContain('NebulaConfiguration');
    expect(acceptedWords).toContain('Python');
});

test('gspot installed from npm suggests gspot add sql for a SQL file, and SQLFluff reports a parse error', async () => {
    await using installation = await createUserProject();
    await initSandbox(installation.online, { configurations: ['bash'] });
    const { root, offline, online } = installation;
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const listed = await offline.run(root, ['list', '--json'], offline.environment);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const available = JSON.parse(listed.stdout) as ConfigurationsListJson;
    expect(available.available.map(({ name }) => name)).toContain('sql');
    const inspected = await offline.run(root, ['doctor', '--json'], offline.environment);
    const report = JSON.parse(inspected.stdout) as DoctorReport;
    expect(inspected.code, inspected.stdout + inspected.stderr).toBe(report.exitCode);
    expect(report.suggestions.detected.find((configuration) => configuration.configuration === 'sql')?.command).toBe(
        'gspot add sql',
    );
    for (const command of [['add', 'sql'], ['set', 'tools.sqlfluff.dialect', 'postgres'], ['install']]) {
        const result = await online.run(root, command, online.environment);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const sqlCheck = ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'];
    await writeFile(join(root, 'query.sql'), 'SELECT FROM;\n');
    const failed = parseCheckReport(await offline.run(root, sqlCheck, offline.environment));
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.map(({ check, status, fileCount, findings }) => ({
            check,
            status,
            fileCount,
            findings: findings.map(({ file, line, rule }) => ({ file, line, rule })),
        })),
    ).toStrictEqual([
        {
            check: 'sql/sqlfluff',
            status: 'failed',
            fileCount: 1,
            findings: [{ file: 'query.sql', line: 1, rule: 'PRS' }],
        },
    ]);
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const passed = parseCheckReport(await offline.run(root, sqlCheck, offline.environment));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(
        passed.report.checks.map(({ check, status, fileCount, findings }) => ({ check, status, fileCount, findings })),
    ).toStrictEqual([{ check: 'sql/sqlfluff', status: 'passed', fileCount: 1, findings: [] }]);
});
