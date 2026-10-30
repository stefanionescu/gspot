import * as fs from 'node:fs';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import * as systemEnvironment from 'std-env';
import { testdir, createFileTree } from 'testdirs';
import { mock, test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { STOPPED_ERROR_MESSAGE, GENERATED_WRITE_MESSAGE } from '#tests/config/commands/init/write.ts';

test('init keeps the old config file when the generated one cannot be written', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    commitAll(sandbox.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, getManifestTarget('spelling', 'typos.toml')))
            throw new Error(GENERATED_WRITE_MESSAGE);
        rename(source, target);
    });
    const refused = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'spelling']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(STOPPED_ERROR_MESSAGE);
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    const exists = await isOnDisk(join(sandbox.path, getManifestTarget('spelling', 'typos.toml')));
    expect(exists).toBe(false);
});

test('init keeps a shared file that was edited after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await createGitSandbox({
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    await using _terminal = await fakeInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'setup.cfg'), edited);
            return true;
        }),
    );
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    const exists = await isOnDisk(join(sandbox.path, getManifestTarget('sql', 'sqlfluff.cfg')));
    expect(exists).toBe(true);
});

test.each([true, false])('init writes gspot.toml only when you confirm the plan (answer %p)', async (answer) => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    await using _terminal = await fakeInteractiveTerminal();
    using confirmation = spyOn(clack, 'confirm').mockResolvedValue(answer);
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(answer);
    expect(confirmation).toHaveBeenCalledWith({ message: 'Continue?', initialValue: true, output: process.stderr });
});

test('init writes nothing and says Canceled. Nothing was written. when you cancel the confirmation', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    await using _terminal = await fakeInteractiveTerminal();
    using _confirmation = spyOn(clack, 'confirm').mockResolvedValue(Symbol('cancel'));
    const refused = await runGspot(sandbox.path, ['init']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('Canceled. Nothing was written.\n');
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

async function fakeInteractiveTerminal(): Promise<AsyncDisposable> {
    const resources = new AsyncDisposableStack();
    const previousEnvironment = { ...systemEnvironment };
    await mock.module('std-env', () => ({ ...previousEnvironment, isCI: false }));
    resources.defer(async () => {
        await mock.module('std-env', () => previousEnvironment);
    });
    resources.use(
        fakeTerminals([
            [process.stdin, true],
            [process.stderr, true],
        ]),
    );
    return resources;
}
