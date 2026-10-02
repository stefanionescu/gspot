// Installs built packages from an isolated registry: one consumer's pinned language tools report defects and accept
// corrections.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/package.ts';
import { parseAlerts } from '#cli/checks/general/prose/vale.ts';
import type { InstalledConsumer } from '#tests/types/package.ts';
import type { RunReport } from '#cli/types/execution/execution.ts';
import { createConsumer } from '#tests/support/package/consumer.ts';
import { initializeConsumer, getPublishedRelease } from '#tests/support/package/published.ts';

const release = getPublishedRelease();

// The installed vocabulary reports case mismatches and accepts the canonical project terms.
async function expectInstalledVocabulary(installation: InstalledConsumer): Promise<void> {
    const { consumer, options } = installation;
    writeFileSync(
        join(consumer, 'vocabulary.ini'),
        'StylesPath = .gspot/config/vale/styles\nVocab = gspot\nMinAlertLevel = suggestion\n\n[*]\nBasedOnStyles = Vale\nVale.Spelling = NO\nVale.Terms = YES\n',
    );
    writeFileSync(join(consumer, 'vocabulary.md'), 'typescript supports nebulakit.\n');
    const termsCommand = ['vale', '--config', 'vocabulary.ini', '--output', 'JSON', '--no-exit', 'vocabulary.md'];
    const terms = await run(termsCommand, options);
    expect(terms.code, terms.stdout + terms.stderr).toBe(0);
    const alerts = parseAlerts(terms.stdout);
    expect(alerts.map(({ file, check, line, message: text }) => ({ file, check, line, text }))).toStrictEqual([
        { file: 'vocabulary.md', check: 'Vale.Terms', line: 1, text: "Use 'TypeScript' instead of 'typescript'." },
        { file: 'vocabulary.md', check: 'Vale.Terms', line: 1, text: "Use 'NebulaKit' instead of 'nebulakit'." },
    ]);
    writeFileSync(join(consumer, 'vocabulary.md'), 'TypeScript supports NebulaKit.\n');
    const correctedTerms = await run(termsCommand, options);
    expect(correctedTerms.code, correctedTerms.stdout + correctedTerms.stderr).toBe(0);
    expect(JSON.parse(correctedTerms.stdout)).toStrictEqual({});
}

// SQL discovery and its embedded parser work after installation without checkout dependencies.
async function expectInstalledSql(installation: InstalledConsumer): Promise<void> {
    const { consumer, command, options, setupOptions } = installation;
    writeFileSync(join(consumer, 'query.sql'), 'SELECT 1;\n');
    const detected = await run([...command, 'list', '--json'], options);
    expect(detected.code, detected.stdout + detected.stderr).toBe(0);
    const available = JSON.parse(detected.stdout) as { detected: { name: string; command: string }[] };
    expect(available.detected.find((configuration) => configuration.name === 'sql')?.command).toBe('gspot add sql');
    const added = await run([...command, 'add', 'sql'], setupOptions);
    expect(added.code, added.stdout + added.stderr).toBe(0);
    const sql = await run([...command, 'check', 'query.sql', '--only', 'sql/syntax', '--json'], options);
    expect(sql.code, sql.stdout + sql.stderr).toBe(0);
    const sqlReport = JSON.parse(sql.stdout) as RunReport;
    expect(sqlReport.skips).toStrictEqual([]);
    expect(sqlReport.checks).toHaveLength(1);
    expect(sqlReport.checks[0]).toMatchObject({
        check: 'sql/syntax',
        status: 'ok',
        files: 1,
        findings: [],
    });
}

// A check reports the planted defect at its location and rule, then passes once the file holds the correction.
async function expectCorrection(
    installation: InstalledConsumer,
    check: { only: string; path: string; defect: string; corrected: string; finding: { line: number; rule: string } },
): Promise<void> {
    const { consumer, command, options } = installation;
    const args = [...command, 'check', check.path, '--only', check.only, '--json'];
    writeFileSync(join(consumer, check.path), check.defect);
    const failed = await run(args, options);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks).toMatchObject([
        { check: check.only, status: 'fail', findings: [{ file: check.path, ...check.finding }] },
    ]);
    writeFileSync(join(consumer, check.path), check.corrected);
    const passed = await run(args, options);
    expect(passed.code, passed.stdout + passed.stderr).toBe(0);
}

test(
    'one installed consumer runs the pinned language tools against defects and their corrections',
    async () => {
        await using installation = await createConsumer(release.registry, release.version);
        expect(installation.installed.code, installation.installed.stdout + installation.installed.stderr).toBe(0);
        const { command, options } = installation;
        await initializeConsumer(release, installation);
        const vocabulary = await run(
            [...command, 'set', 'prose.vocabulary', 'NebulaKit', '--reason', 'NebulaKit is the project name.'],
            options,
        );
        expect(vocabulary.code, vocabulary.stdout + vocabulary.stderr).toBe(0);
        await expectCorrection(installation, {
            only: 'prose/vale',
            path: 'guide.md',
            defect: '# Schedule\n\nNebulaKit uses TypeScript. Release on 03/04/2026.\n',
            corrected: '# Schedule\n\nNebulaKit uses TypeScript. Release on March 4, 2026.\n',
            finding: { line: 3, rule: 'gspot.dates' },
        });
        await expectInstalledVocabulary(installation);
        await expectCorrection(installation, {
            only: 'python/ruff',
            path: 'entry.py',
            defect: 'answer = missing_name\n',
            corrected: 'answer = "example"\n',
            finding: { line: 1, rule: 'F821' },
        });
        await expectCorrection(installation, {
            only: 'bash/shellcheck',
            path: 'broken.sh',
            defect: '#!/usr/bin/env bash\nprintf "%s\\n" $1\n',
            corrected: '#!/usr/bin/env bash\nprintf "%s\\n" "$1"\n',
            finding: { line: 2, rule: 'SC2086' },
        });
        const level = await run([...command, 'set', 'level', 'all'], options);
        expect(level.code, level.stdout + level.stderr).toBe(0);
        await expectCorrection(installation, {
            only: 'naming/identifiers',
            path: 'Account.swift',
            defect: 'let utils = 1\n',
            corrected: 'let account = 1\n',
            finding: { line: 1, rule: 'banned-term' },
        });
        await expectInstalledSql(installation);
    },
    RELEASE_TIMEOUT_MS,
);
