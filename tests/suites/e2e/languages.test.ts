import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFile, writeFile } from 'node:fs/promises';
import type { GspotProject } from '#tests/types/packages.ts';
import { initSandbox } from '#tests/setup/sandboxes/create.ts';
import { parseCheckReport } from '#tests/setup/cli/commands.ts';
import { assertCheckSample } from '#tests/setup/cli/samples.ts';
import { GUIDE_READ_MARKDOWN } from '#tests/config/documents.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { PROSE_CHECK, SWIFT_CHECK } from '#tests/config/e2e/languages.ts';
import { createGspotProject } from '#tests/setup/sandboxes/projects/gspot.ts';

async function prepareLanguages(installation: GspotProject): Promise<void> {
    const { online } = installation;
    await createFileTree(installation.root, {
        'entry.py': 'answer = "example"\n',
        'script.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': GUIDE_READ_MARKDOWN,
    });
    await initSandbox(online, { configurations: ['bash', 'python', 'swift'] });
    const vocabulary = await online.run(installation.root, [
        'set',
        'spelling.allowed_words',
        'NebulaConfiguration',
        '--reason',
        'NebulaConfiguration is the project name.',
    ]);
    expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
}

test('gspot installed from npm runs Vale and the built-in Swift naming check, reports their findings, and passes after the fixes', async () => {
    await using installation = await createGspotProject();
    await prepareLanguages(installation);
    await assertCheckSample(installation.offline, PROSE_CHECK);
    const level = await installation.online.run(installation.root, ['set', 'level', 'all']);
    expect(level.code, level.stdout + level.stderr).toBe(0);
    await assertCheckSample(installation.offline, SWIFT_CHECK);
    const vocabulary = await readFile(
        join(installation.root, getManifestTarget('prose', 'styles/config/vocabularies/words/accept.txt')),
        'utf8',
    );
    const acceptedWords = vocabulary.trim().split('\n');
    expect(acceptedWords).toContain('NebulaConfiguration');
    expect(acceptedWords).toContain('Python');
});

test('gspot installed from npm suggests gspot add sql for a SQL file, and SQLFluff reports a parse error', async () => {
    await using installation = await createGspotProject();
    await initSandbox(installation.online, { configurations: ['bash'] });
    const { root, offline, online } = installation;
    await writeFile(join(root, 'query.sql'), 'SELECT 1;\n');
    const inspected = await offline.run(root, ['doctor', '--json']);
    const report = JSON.parse(inspected.stdout) as DoctorReport;
    expect(inspected.code, inspected.stdout + inspected.stderr).toBe(report.exitCode);
    expect(report.suggestions.detected.find((configuration) => configuration.configuration === 'sql')?.command).toBe(
        'gspot add sql',
    );
    for (const command of [['add', 'sql'], ['set', 'tools.sqlfluff.dialect', 'postgres'], ['install']]) {
        const result = await online.run(root, command);
        expect(result.code, result.stdout + result.stderr).toBe(0);
    }
    const sqlCheck = ['check', 'query.sql', '--only', 'sql/sqlfluff', '--json'];
    await writeFile(join(root, 'query.sql'), 'SELECT FROM;\n');
    const failed = parseCheckReport(await offline.run(root, sqlCheck));
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
    const passed = parseCheckReport(await offline.run(root, sqlCheck));
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
    expect(
        passed.report.checks.map(({ check, status, fileCount, findings }) => ({ check, status, fileCount, findings })),
    ).toStrictEqual([{ check: 'sql/sqlfluff', status: 'passed', fileCount: 1, findings: [] }]);
});
