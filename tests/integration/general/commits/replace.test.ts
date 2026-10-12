import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { sandboxPath } from '#tests/setup/install.ts';
import { testModules } from '#tests/setup/modules.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { buildInitArguments } from '#tests/setup/init.ts';
import { COMMITLINT_FILES, COMMITLINT_PACKAGE, COMMITLINT_EXECUTABLE } from '#tests/config/commitlint.ts';

test.each([...COMMITLINT_FILES])('init replaces your commitlint file $file', async ({ file, source }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { [file]: source, 'message.txt': 'special: authored contract\n' });
    commitAll(sandbox.path);
    const execution = { cwd: sandbox.path, env: { PATH: sandboxPath() } };
    const before = await runCommand([join(testModules, COMMITLINT_EXECUTABLE), '--edit', 'message.txt'], execution);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const initialized = await runGspot(sandbox.path, buildInitArguments(['none']), execution.env);
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
    const command = [
        join(testModules, COMMITLINT_EXECUTABLE),
        '--config',
        '.gspot/config/commitlint.config.cjs',
        '--edit',
        'message.txt',
    ];
    const after = await runCommand(command, execution);
    expect(after.code, after.stdout + after.stderr).toBe(1);
    expect(after.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
    await Bun.write(join(sandbox.path, 'message.txt'), 'fix: generated contract\n');
    const corrected = await runCommand(command, execution);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test.each(['', 'app'])(
    'commitlint reads the generated config through the package.json field gspot writes, in %s',
    async (scope) => {
        await using sandbox = await testdir();
        const { packageFile, messageFile, cwd } = {
            packageFile: posix.join(scope, 'package.json'),
            messageFile: posix.join(scope, 'message.txt'),
            cwd: join(sandbox.path, scope),
        };
        await createFileTree(sandbox.path, {
            [packageFile]: COMMITLINT_PACKAGE,
            [messageFile]: 'special: authored contract\n',
        });
        commitAll(sandbox.path);
        const execution = { cwd, env: { PATH: sandboxPath() } };
        const command = [join(testModules, COMMITLINT_EXECUTABLE), '--edit', join(sandbox.path, messageFile)];
        const before = await runCommand(command, execution);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const initialized = await runGspot(sandbox.path, buildInitArguments(['none']), execution.env);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        const target =
            scope === '' ? './.gspot/config/commitlint.config.cjs' : '../.gspot/config/commitlint.config.cjs';
        expect(await Bun.file(join(sandbox.path, packageFile)).text()).toBe(
            COMMITLINT_PACKAGE.replace(
                '{"rules":{"type-enum":[2,"always",["special"]]}}',
                JSON.stringify({ extends: target }),
            ),
        );
        const after = await runCommand(command, execution);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
        for (const level of ['recommended', 'all']) {
            const changed = await runGspot(sandbox.path, ['set', 'level', level]);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
            const native = await runCommand(command, execution);
            expect(native.code, native.stdout + native.stderr).toBe(level === 'all' ? 1 : 0);
            if (level === 'all') expect(native.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
            else {
                expect(await Bun.file(join(sandbox.path, packageFile)).text()).toBe(COMMITLINT_PACKAGE);
                expect(await Bun.file(join(sandbox.path, '.gspot/config/commitlint.config.cjs')).exists()).toBe(false);
            }
        }
        await Bun.write(join(sandbox.path, messageFile), 'fix: generated contract\n');
        const corrected = await runCommand(command, execution);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
