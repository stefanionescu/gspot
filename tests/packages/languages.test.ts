// Installs built packages from an isolated registry: one consumer's pinned language tools report defects and accept
// corrections.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { runTestCommand } from '#tests/harness/command.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { runPackageCheck } from '#tests/harness/check-case.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/release.ts';
import { BASH_CHECK, PROSE_CHECK, SWIFT_CHECK, PYTHON_CHECK } from '#tests/config/packages/languages.ts';

const release = getPublishedRelease();

// Prepare the installed consumer and its project vocabulary before observing native checks.
async function prepareLanguages(installation: Consumer): Promise<void> {
    const { command, onlineOptions } = installation;
    writeFileSync(join(installation.root, 'entry.py'), 'answer = "example"\n');
    await createFileTree(installation.root, {
        'broken.sh': '#!/usr/bin/env bash\necho example\n',
        'guide.md': '# Guide\n\nRead the guide.\n',
    });
    await initializeConsumer(release, installation);
    const vocabulary = await runTestCommand(
        [
            ...command,
            'set',
            'prose.vocabulary',
            'NebulaConfiguration',
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
    writeFileSync(join(root, 'query.sql'), 'SELECT 1;\n');
    const detected = await runTestCommand([...command, 'list', '--json'], offlineOptions);
    expect(detected.code, detected.stdout + detected.stderr).toBe(0);
    const available = JSON.parse(detected.stdout) as ConfigurationsListJson;
    expect(available.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
    const added = await runTestCommand([...command, 'add', 'sql'], onlineOptions);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const configured = await runTestCommand([...command, 'set', 'tools.sqlfluff.dialect', 'postgres'], onlineOptions);
    expect(configured.code, configured.stdout + configured.stderr).toBe(0);
    writeFileSync(join(root, 'query.sql'), 'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n');
    const defect = await runTestCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/trivial-functions', '--json'],
        offlineOptions,
    );
    expect(defect.code, defect.stdout + defect.stderr).toBe(1);
    expect((JSON.parse(defect.stdout) as RunReport).checks).toMatchObject([
        { check: 'sql/trivial-functions', status: 'failed', findings: [{ file: 'query.sql', line: 1 }] },
    ]);
    expect(readFileSync(join(root, 'query.sql'), 'utf8')).toBe(
        'CREATE FUNCTION value() RETURNS int LANGUAGE sql RETURN 1;\n',
    );
    writeFileSync(join(root, 'query.sql'), 'SELECT 1;\n');
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

test(
    'one installed consumer runs the pinned language tools against defects and their corrections',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);

        await prepareLanguages(installation);
        for (const check of [PROSE_CHECK, PYTHON_CHECK, BASH_CHECK, SWIFT_CHECK]) {
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
                const acceptedWords = readFileSync(
                    join(installation.root, '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt'),
                    'utf8',
                )
                    .trim()
                    .split('\n');
                expect(acceptedWords).toContain('NebulaConfiguration');
                expect(acceptedWords).toContain('TypeScript');
            }
        }
        await expectInstalledSql(installation);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
