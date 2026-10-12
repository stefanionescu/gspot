import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { mkdir } from 'node:fs/promises';
import { git } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { BYTES_PER_KB } from '#cli/config/units.ts';
import { openSession } from '#cli/commands/session.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/built-in.ts';
import { buildCheckInput } from '#tests/setup/check-input.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { runGspot, checkReport } from '#tests/setup/run-gspot.ts';
import { TRACKED_PATTERNS, LARGE_FILE_SETTINGS, LARGE_FILE_ATTRIBUTES } from '#tests/config/repository.ts';

test("tracked-files follows each scope's configurations: env files, dependency folders and build output are reported", async () => {
    await using sandbox = await testdir();
    const { refused, allowed, scopes, indexOnly } = TRACKED_PATTERNS;
    const settings = settingsText(['javascript'], { level: 'all', tables: scopes });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        ...Object.fromEntries([...refused, ...allowed].map((path) => [path, 'PUBLIC_EXAMPLE=value\n'])),
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    const staged = git(sandbox.path, ['add', '-f', '.']);
    expect(staged.code, staged.stderr).toBe(0);
    const input = buildCheckInput(await openSession(sandbox.path), 'repository/tracked-files', { paths: [] });
    const found = CHECK_FUNCTIONS['repository/tracked-files']({
        ...input,
        index: [...input.index, ...input.index, ...indexOnly.map((path) => ({ ...input.index[0]!, path }))],
    });
    expect(found.map(({ file }) => file).toSorted((left, right) => left.localeCompare(right))).toStrictEqual(
        [...refused, ...indexOnly].toSorted((left, right) => left.localeCompare(right)),
    );
    expect(found.every(({ rule, line }) => rule === 'tracked-file' && line === 1)).toBe(true);
});

test('a tracked dependency folder is reported and passes after git rm --cached', async () => {
    await using repository = await createSandbox(BASH_REPOSITORY);
    const { root, environment } = repository;
    const command = ['check', '--only', 'repository/tracked-files', '--json'];
    const clean = await runGspot(root, command, environment);
    expect(clean.code, clean.stdout + clean.stderr).toBe(0);
    await mkdir(join(root, 'web', 'node_modules', 'left-pad'), { recursive: true });
    await Bun.write(join(root, 'web', 'node_modules', 'left-pad', 'index.js'), 'module.exports = 1;\n');
    expect(git(root, ['add', '-f', 'web/node_modules/left-pad/index.js']).code).toBe(0);
    const tracked = await checkReport(root, command, environment);
    expect(tracked.code).toBe(1);
    expect(tracked.report.checks).toMatchObject([
        {
            check: 'repository/tracked-files',
            status: 'failed',
            findings: [{ file: 'web/node_modules/left-pad/index.js', rule: 'tracked-file', line: 1 }],
        },
    ]);
    expect(git(root, ['rm', '-r', '--cached', '--quiet', 'web/node_modules']).code).toBe(0);
    const corrected = await checkReport(root, command, environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([
        { check: 'repository/tracked-files', status: 'passed', findings: [] },
    ]);
});

test('large files are reported in every scope except LFS, generated and vendored files, and pass once shrunk', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['javascript'], {
        level: 'all',
        tables: LARGE_FILE_SETTINGS,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        '.gitattributes': LARGE_FILE_ATTRIBUTES,
        ...Object.fromEntries(
            ['big.bin', 'app/big.bin', 'lfs.bin', 'data/big.bin', 'vendor/big.bin'].map((path) => [
                path,
                Buffer.alloc(BYTES_PER_KB + 1),
            ]),
        ),
        'small.txt': 'small',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    expect(git(sandbox.path, ['add', '-f', '.']).code).toBe(0);
    const command = ['check', '--only', 'repository/large-files', '--json'];
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(
        failed.report.checks.flatMap(({ findings }) => findings.map(({ file, rule, line }) => ({ file, rule, line }))),
    ).toStrictEqual([
        { file: 'app/big.bin', rule: 'size', line: 1 },
        { file: 'big.bin', rule: 'size', line: 1 },
    ]);
    await Bun.write(join(sandbox.path, 'app/big.bin'), Buffer.alloc(BYTES_PER_KB));
    await Bun.write(join(sandbox.path, 'big.bin'), Buffer.alloc(BYTES_PER_KB));
    expect(git(sandbox.path, ['add', '-f', 'app/big.bin', 'big.bin']).code).toBe(0);
    const fixed = await checkReport(sandbox.path, command);
    expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
    expect(fixed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});
