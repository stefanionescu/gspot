import { join, posix } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { runGspot } from '#tests/harness/gspot.ts';
import { testdir, createFileTree } from 'testdirs';
import { prepare } from '#cli/commands/init/public.ts';
import { buildInitOptions } from '#tests/harness/init.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { writeSetup } from '#cli/commands/init/contracts.ts';
import { parseTemplate } from '#cli/policy/document/contracts.ts';
import { COMMITLINT_PACKAGE } from '#tests/config/samples/commitlint.ts';
import { COMMITLINT_TAKEOVERS } from '#tests/config/tools/configurations/general/commits/takeover.ts';

test.each(COMMITLINT_TAKEOVERS)(
    'initialization retires the native Commitlint configuration $file',
    async ({ file, source }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { [file]: source, 'message.txt': 'special: authored contract\n' });
        commitAll(sandbox.path);
        const before = await runTestCommand(['commitlint', '--edit', 'message.txt'], { cwd: sandbox.path });
        expect(before.code, before.stdout + before.stderr).toBe(0);
        const options = buildInitOptions(sandbox.path, {
            configurations: ['none'],
            template: parseTemplate('template = "coverage"\nselection = "detect"\nlevel = "all"\n', 'level.toml'),
        });
        const prepared = await prepare(sandbox.path, options);
        expect(prepared.plan.remove).toContainEqual({
            path: file,
            note: 'replaced by the generated commitlint configuration',
        });
        const initialized = await writeSetup(sandbox.path, options, prepared);
        expect(initialized.exitCode).toBe(0);
        expect(await Bun.file(join(sandbox.path, file)).exists()).toBe(false);
        const command = ['commitlint', '--config', '.gspot/config/commitlint.config.cjs', '--edit', 'message.txt'];
        const after = await runTestCommand(command, { cwd: sandbox.path });
        expect(after.code, after.stdout + after.stderr).toBe(1);
        expect(after.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
        await Bun.write(join(sandbox.path, 'message.txt'), 'fix: generated contract\n');
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);

test.each(['', 'app'])('native Commitlint discovery follows only the managed package field in %s', async (scope) => {
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
    const command = ['commitlint', '--edit', join(sandbox.path, messageFile)];
    const before = await runTestCommand(command, { cwd });
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const options = buildInitOptions(sandbox.path, {
        configurations: ['none'],
        template: parseTemplate('template = "coverage"\nselection = "detect"\nlevel = "all"\n', 'level.toml'),
    });
    const prepared = await prepare(sandbox.path, options);
    expect(prepared.plan.change).toContainEqual({
        path: packageFile,
        note: 'managed commitlint fields; other content stays',
    });
    expect(prepared.plan.remove.some((entry) => entry.path === packageFile)).toBe(false);
    const initialized = await writeSetup(sandbox.path, options, prepared);
    expect(initialized.exitCode).toBe(0);
    const target = scope === '' ? './.gspot/config/commitlint.config.cjs' : '../.gspot/config/commitlint.config.cjs';
    expect(await Bun.file(join(sandbox.path, packageFile)).text()).toBe(
        COMMITLINT_PACKAGE.replace(
            '{"rules":{"type-enum":[2,"always",["special"]]}}',
            JSON.stringify({ extends: [target] }),
        ),
    );
    const after = await runTestCommand(command, { cwd });
    expect(after.code, after.stdout + after.stderr).toBe(1);
    expect(after.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
    for (const level of ['recommended', 'all']) {
        const changed = await runGspot(sandbox.path, ['set', 'level', level]);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const native = await runTestCommand(command, { cwd });
        expect(native.code, native.stdout + native.stderr).toBe(level === 'all' ? 1 : 0);
        if (level === 'all') expect(native.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
        else {
            expect(await Bun.file(join(sandbox.path, packageFile)).text()).toBe(COMMITLINT_PACKAGE);
            expect(await Bun.file(join(sandbox.path, '.gspot/config/commitlint.config.cjs')).exists()).toBe(false);
        }
    }
    await Bun.write(join(sandbox.path, messageFile), 'fix: generated contract\n');
    const corrected = await runTestCommand(command, { cwd });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
