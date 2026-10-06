// Shared vocabulary and exact category declarations preserve neighboring findings through public commands.
import { join } from 'node:path';
import { renameSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';

import {
    GROUP_SOURCE,
    NUMBERED_FILES,
    ORDINARY_WORDS,
    RESERVED_FILES,
    RESERVED_POLICY,
    GROUP_EXCEPTIONS,
    PREFIX_EXCEPTION,
    REPEATED_EXCEPTION,
} from '#tests/config/cli/checks/naming.ts';

test('ordinary response and domain words pass while an adjacent banned name still fails', async () => {
    await using sandbox = await testdir();
    const source = ORDINARY_WORDS.map((name) => `export const ${name} = 1;\n`).join('');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], { level: 'all' }),
        'entry.ts': source + 'export const userHelper = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: ORDINARY_WORDS.length + 1, rule: 'banned-term' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.ts'), source + 'export const userCount = 1;\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
        { check: 'naming/identifiers', status: 'passed', findings: [] },
    ]);
});

test('reserved categories apply literally and child declarations leave sibling contracts intact', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], { level: 'all', tables: RESERVED_POLICY }),
        ...RESERVED_FILES,
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: 1, column: 14, rule: 'reserved-term' },
        { file: 'app/entry.ts', line: 2, column: 21, rule: 'reserved-term' },
        { file: 'sibling/entry.ts', line: 1, column: 14, rule: 'reserved-term' },
    ]);
    for (const [path, source] of Object.entries(RESERVED_FILES)) {
        const corrected = path.startsWith('app/')
            ? source.replace('record: string', 'entry: string')
            : source.replace('const record', 'const entry');
        await Bun.write(join(sandbox.path, path), corrected);
    }
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        (JSON.parse(corrected.stdout) as RunReport).checks.every(
            ({ status, findings }) => status === 'passed' && findings.length === 0,
        ),
    ).toBe(true);
});

test('reasoned time and condition word exceptions leave required groups and conjunctions active', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['typescript', 'naming'], { level: 'all' });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'entry.ts': GROUP_SOURCE });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ line, rule }) => ({ line, rule })),
        ),
    ).toStrictEqual([
        { line: 1, rule: 'banned-term' },
        { line: 2, rule: 'banned-term' },
        { line: 3, rule: 'banned-term' },
        { line: 4, rule: 'banned-term' },
        { line: 5, rule: 'banned-term' },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy + GROUP_EXCEPTIONS);
    const narrowed = await runGspot(sandbox.path, command);
    expect(narrowed.code, narrowed.stdout + narrowed.stderr).toBe(1);
    expect(
        (JSON.parse(narrowed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ line, rule }) => ({ line, rule })),
        ),
    ).toStrictEqual([
        { line: 3, rule: 'banned-term' },
        { line: 4, rule: 'banned-term' },
        { line: 5, rule: 'banned-term' },
    ]);
    await Bun.write(
        join(sandbox.path, 'entry.ts'),
        GROUP_SOURCE.replace('plusValue', 'sumValue')
            .replace('enhancedValue', 'entry')
            .replace('ensureValue', 'validatedValue'),
    );
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('hidden folders preserve filename checks without needing a list of tool directory names', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], { level: 'all' }),
        '.archive/bad_name.ts': 'export const entry = 1;\n',
        '.claude/entry.ts': 'export const entry = 1;\n',
        '.vscode/entry.ts': 'export const entry = 1;\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: '.archive/bad_name.ts', line: 1, column: 1, rule: 'case' },
    ]);
    renameSync(join(sandbox.path, '.archive/bad_name.ts'), join(sandbox.path, '.archive/bad-name.ts'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('numbered task paths require their authored prefix contract', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['bash', 'naming'], { level: 'all' });
    await createFileTree(sandbox.path, { 'gspot.toml': policy, ...NUMBERED_FILES });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        (JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) =>
            findings.map(({ file, rule }) => ({ file, rule })),
        ),
    ).toStrictEqual([
        { file: '.mise/tasks/01-build.sh', rule: 'case' },
        { file: '.mise/tasks/01-build.sh', rule: 'digits' },
        { file: 'scripts/steps/01-build.sh', rule: 'case' },
        { file: 'scripts/steps/01-build.sh', rule: 'digits' },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), policy + PREFIX_EXCEPTION);
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('an advanced guide receives the ordinary vocabulary rule', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['markdown', 'naming'], { level: 'all' }),
        'ADVANCED.md': '# Guide\n',
    });
    const command = ['check', '--only', 'naming/paths', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'ADVANCED.md', line: 1, column: 1, rule: 'banned-term' },
    ]);
    renameSync(join(sandbox.path, 'ADVANCED.md'), join(sandbox.path, 'guide.md'));
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});

test('an exact repeated-word exception preserves the neighboring duplicate-word diagnostic', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript', 'naming'], { level: 'all', tables: REPEATED_EXCEPTION }),
        'entry.ts': 'export const userUser = 1;\nexport const accountAccount = 1;\n',
    });
    const command = ['check', '--only', 'naming/identifiers', '--json'];
    const failed = await runGspot(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect((JSON.parse(failed.stdout) as RunReport).checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'entry.ts', line: 2, column: 14, rule: 'duplicate-words' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.ts'), 'export const userUser = 1;\nexport const account = 1;\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([{ status: 'passed', findings: [] }]);
});
