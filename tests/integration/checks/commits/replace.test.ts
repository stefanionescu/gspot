import { test, expect } from 'bun:test';
import { join, posix } from 'node:path';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { parseJsonFile } from '#cli/parsers/json.ts';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { testModules } from '#tests/setup/modules.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { buildSandboxPath } from '#tests/setup/install.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { COMMITLINT_PACKAGE, COMMITLINT_EXECUTABLE } from '#tests/data/checks/commits.ts';

/** Check that the authored Commitlint rules pass, then run init with the imported settings. */
async function replaceCommitlint(
    root: string,
    command: string[],
    execution: { cwd: string; env: Record<string, string> },
): Promise<void> {
    await using template = await testdir({ 'gspot.toml': buildSettingsText([], { level: 'all' }) });
    const before = await runCommand(command, execution);
    expect(before.code, before.stdout + before.stderr).toBe(0);
    const initialized = await runGspot(
        root,
        [...buildInitArguments([]), '--no-configurations', '--from', join(template.path, 'gspot.toml')],
        execution.env,
    );
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
}

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
        const execution = { cwd, env: { PATH: buildSandboxPath() } };
        const command = [join(testModules, COMMITLINT_EXECUTABLE), '--edit', join(sandbox.path, messageFile)];
        await replaceCommitlint(sandbox.path, command, execution);
        const target =
            scope === ''
                ? './.gspot/configurations/general/commits/commitlint.json'
                : '../.gspot/configurations/general/commits/commitlint.json';
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
            const packageText = await Bun.file(join(sandbox.path, packageFile)).text();
            expect(JSON.parse(packageText)).not.toHaveProperty('commitlint');
            expect(JSON.parse(packageText)).toEqual(
                Object.fromEntries(
                    Object.entries(parseJsonFile('package.json', COMMITLINT_PACKAGE)).filter(
                        ([key]) => key !== 'commitlint',
                    ),
                ),
            );
            const generatedConfig = join(sandbox.path, '.gspot/configurations/general/commits/commitlint.json');
            expect(await Bun.file(generatedConfig).exists()).toBe(level === 'all');
            if (level === 'all') {
                const native = await runCommand([...command, '--config', generatedConfig], execution);
                expect(native.code, native.stdout + native.stderr).toBe(1);
                expect(native.stdout.match(/\[type-enum\]/gu)).toStrictEqual(['[type-enum]']);
            }
        }
        await Bun.write(join(sandbox.path, messageFile), 'fix: generated contract\n');
        const corrected = await runCommand(
            [...command, '--config', join(sandbox.path, '.gspot/configurations/general/commits/commitlint.json')],
            execution,
        );
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    },
);
