// Installs built packages from an isolated registry: one consumer's pinned language tools report defects and accept
// corrections.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { readFileSync, writeFileSync } from 'node:fs';
import { runTestCommand } from '#tests/harness/command.ts';
import { createConsumer } from '#tests/harness/consumer.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { expectPackageCheck } from '#tests/harness/expectations.ts';
import type { ConfigurationsListJson } from '#cli/types/commands/list.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/harness/release.ts';
import { BASH_CHECK, PROSE_CHECK, SWIFT_CHECK, PYTHON_CHECK } from '#tests/config/packages/languages.ts';

const release = getPublishedRelease();

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
    const sql = await runTestCommand(
        [...command, 'check', 'query.sql', '--only', 'sql/syntax', '--json'],
        offlineOptions,
    );
    expect(sql.code, sql.stdout + sql.stderr).toBe(0);
    const sqlReport = JSON.parse(sql.stdout) as RunReport;
    expect(sqlReport.skips).toStrictEqual([]);
    expect(sqlReport.checks).toHaveLength(1);
    expect(sqlReport.checks[0]).toMatchObject({
        check: 'sql/syntax',
        status: 'passed',
        fileCount: 1,
        findings: [],
    });
}

test(
    'one installed consumer runs the pinned language tools against defects and their corrections',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);

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
        await expectPackageCheck(installation, installation.offlineOptions, PROSE_CHECK);
        const acceptedWords = readFileSync(
            join(installation.root, '.gspot/config/vale/styles/config/vocabularies/gspot/accept.txt'),
            'utf8',
        )
            .trim()
            .split('\n');
        expect(acceptedWords).toContain('NebulaConfiguration');
        expect(acceptedWords).toContain('TypeScript');
        await expectPackageCheck(installation, installation.offlineOptions, PYTHON_CHECK);
        await expectPackageCheck(installation, installation.offlineOptions, BASH_CHECK);
        const level = await runTestCommand([...command, 'set', 'level', 'all'], onlineOptions);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        await expectPackageCheck(installation, installation.offlineOptions, SWIFT_CHECK);
        await expectInstalledSql(installation);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
