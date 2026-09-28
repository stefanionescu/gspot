import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { rejection } from '#tests/support/expectations.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { installHookTool } from '#tests/support/cli/hooks/projects.ts';
import { prepareHookAdoption } from '#tests/support/cli/hooks/adoption.ts';

test.each(['lefthook', 'husky', 'simple-git-hooks', 'pre-commit'] as const)(
    'first adoption preserves an edited %s launcher and accepts native regeneration',
    async (hookTool) => {
        await using repository = await testdir();
        const root = repository.path;
        const { options, prepare, location, names, original } = await prepareHookAdoption(root, hookTool);
        const edited = readFileSync(join(location.absolute, 'commit-msg'), 'utf8') + '\n# Authored launcher edit\n';
        writeFileSync(join(location.absolute, 'commit-msg'), edited);
        const gitConfig = readFileSync(join(root, '.git/config'));
        expect(await rejection(installHookTool(root))).toContain('Retained differing native hook');
        expect(readFileSync(join(location.absolute, 'commit-msg'), 'utf8')).toBe(edited);
        for (const [index, name] of names.entries()) {
            // The refused installation left every other native hook as it was.
            expect(name === 'commit-msg' || original[index]!.equals(readFileSync(join(location.absolute, name)))).toBe(
                true,
            );
            expect(existsSync(join(location.absolute, `${name}.gspot-manager`))).toBe(false);
            expect(existsSync(join(location.absolute, `${name}.gspot-original`))).toBe(false);
        }
        const regenerated = await run(prepare, options);
        expect(regenerated.code, regenerated.stdout + regenerated.stderr).toBe(0);
        await installHookTool(root);
        const checked = await run(['git', 'hook', 'run', 'pre-commit'], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(readFileSync(join(root, 'observed'), 'utf8')).toBe('x');
        expect(readFileSync(join(root, '.git/config'))).toStrictEqual(gitConfig);
    },
    90_000,
);

test('Lefthook adoption refuses an edited native helper then accepts restored bytes', async () => {
    await using repository = await testdir();
    const root = repository.path;
    const { options, location, names } = await prepareHookAdoption(root, 'lefthook');
    const hookScript = join(location.absolute, 'prepare-commit-msg');
    const native = readFileSync(hookScript);
    const editedScript = native.toString('utf8') + '\n# Authored helper edit\n';
    writeFileSync(hookScript, editedScript);
    expect(await rejection(installHookTool(root))).toContain('Retained differing native hook');
    expect(readFileSync(hookScript, 'utf8')).toBe(editedScript);
    for (const name of names) expect(existsSync(join(location.absolute, `${name}.gspot-manager`))).toBe(false);
    writeFileSync(hookScript, native);
    await installHookTool(root);
    const checked = await run(['git', 'hook', 'run', 'pre-commit'], options);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(readFileSync(join(root, 'observed'), 'utf8')).toBe('x');
}, 90_000);

test('Lefthook adoption refuses changed native init configuration then accepts regenerated launchers', async () => {
    await using repository = await testdir();
    const root = repository.path;
    const { options, prepare, location, original } = await prepareHookAdoption(root, 'lefthook');
    const commitText = original[2];
    if (commitText === undefined) throw new Error('Missing native commit-msg fixture');
    writeFileSync(join(location.absolute, 'commit-msg'), commitText);
    const config = join(root, 'lefthook.yml');
    writeFileSync(config, readFileSync(config, 'utf8') + '\nrc: ./native-init.sh\n');
    expect(await rejection(installHookTool(root))).toContain('Retained differing native hook');
    expect(readFileSync(join(location.absolute, 'commit-msg'))).toStrictEqual(commitText);
    const regenerated = await run(prepare, options);
    expect(regenerated.code, regenerated.stdout + regenerated.stderr).toBe(0);
    await installHookTool(root);
    const checked = await run(['git', 'hook', 'run', 'pre-commit'], options);
    expect(checked.code, checked.stdout + checked.stderr).toBe(0);
    expect(readFileSync(join(root, 'observed'), 'utf8')).toBe('x');
}, 90_000);
