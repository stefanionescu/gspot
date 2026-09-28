import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { chmodSync, readdirSync, symlinkSync } from 'node:fs';
import { acceptanceArguments } from '#tests/support/acceptance.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));

test('source acceptance stops its registry and removes storage when publication fails', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        temp: {},
        'bin/npm': '#!/usr/bin/env bun\nconsole.error("Fixture publication refused.");\nprocess.exit(9);\n',
        // Windows resolves npm to npm.cmd, which hands the arguments to the same script.
        'bin/npm.cmd': `@"${process.execPath}" "%~dp0npm" %*\r\n`,
    });
    chmodSync(join(sandbox.path, 'bin/npm'), 0o755);
    const result = await run([process.execPath, join(ROOT, 'tests/support/acceptance.ts')], {
        cwd: join(ROOT, 'tests'),
        env: {
            PATH: [join(sandbox.path, 'bin'), environmentVariables()['PATH']].join(delimiter),
            TMPDIR: join(sandbox.path, 'temp'),
        },
        timeoutMs: 15_000,
    });
    expect(result.code, result.stdout + result.stderr).toBe(9);
    expect(result.isTimedOut).toBe(false);
    expect(result.stderr).toContain('Fixture publication refused.');
    expect(readdirSync(join(sandbox.path, 'temp'))).toStrictEqual([]);
}, 30_000);

test('source acceptance keeps explicit paths and ordered name filters', () => {
    const target = join(ROOT, 'tests/acceptance/source/cli/commits.test.ts');
    expect(acceptanceArguments([])).toStrictEqual(['--timeout', '60000', join(ROOT, 'tests/acceptance/source')]);
    expect(acceptanceArguments(['-t', 'first', target, '--test-name-pattern', 'second'])).toStrictEqual([
        '--timeout',
        '60000',
        '--test-name-pattern',
        'first',
        '--test-name-pattern',
        'second',
        target,
    ]);
});

test.each([
    { args: ['-t'], error: '-t requires a pattern.' },
    { args: ['--test-name-pattern', ''], error: '--test-name-pattern requires a pattern.' },
    { args: ['--unknown'], error: 'Unsupported acceptance option: --unknown.' },
    { args: [ROOT], error: 'Select a source test under tests/acceptance/source.' },
])('source acceptance rejects $args before running setup', ({ args, error }) => {
    expect(() => acceptanceArguments(args)).toThrow(error);
});

test('source acceptance validates symlink destinations before selecting a test', async () => {
    await using sandbox = await testdir();
    const link = join(sandbox.path, 'source');
    symlinkSync(join(ROOT, 'tests/acceptance/source'), link);
    expect(acceptanceArguments([link])).toStrictEqual(['--timeout', '60000', join(ROOT, 'tests/acceptance/source')]);
    const outside = join(sandbox.path, 'outside');
    symlinkSync(join(ROOT, 'tests/acceptance'), outside);
    expect(() => acceptanceArguments([outside])).toThrow('Select a source test under tests/acceptance/source.');
});

test('source command timeout reports its deadline and removes registry storage', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        temp: {},
        'bin/npm': '#!/usr/bin/env bun\nprocess.exit(0);\n',
    });
    chmodSync(join(sandbox.path, 'bin/npm'), 0o755);
    const owner = join(ROOT, 'tests/support/registry/plugin.ts');
    const waiting = 'console.log("Command started."); setInterval(() => {}, 1000);';
    const program = `import { runSourceCommand } from ${JSON.stringify(owner)}; await runSourceCommand([process.execPath, '-e', ${JSON.stringify(waiting)}], process.cwd(), 1000);`;
    const result = await run([process.execPath, '-e', program], {
        cwd: ROOT,
        env: {
            PATH: [join(sandbox.path, 'bin'), environmentVariables()['PATH']].join(delimiter),
            TMPDIR: join(sandbox.path, 'temp'),
        },
        timeoutMs: 15_000,
    });
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.isTimedOut).toBe(false);
    expect(result.stdout).toContain('Command started.');
    expect(result.stderr).toContain('Command exceeded the 1000 ms timeout.');
    expect(readdirSync(join(sandbox.path, 'temp'))).toStrictEqual([]);
}, 30_000);
