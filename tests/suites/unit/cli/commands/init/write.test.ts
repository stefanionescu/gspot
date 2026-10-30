import * as fs from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test, spyOn, expect } from 'bun:test';
import * as readline from 'node:readline/promises';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { fakeTerminals } from '#tests/setup/system/fakes.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { STOPPED_ERROR_MESSAGE, GENERATED_WRITE_MESSAGE } from '#tests/config/commands/init/init.ts';

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
    await using sandbox = await createGitSandbox({
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    using _terminal = fakeTerminalAnswers(
        Readable.from(['y\n']).map(async (answer: string) => {
            await writeFile(join(sandbox.path, 'setup.cfg'), edited);
            return answer;
        }),
    );
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    const exists = await isOnDisk(join(sandbox.path, getManifestTarget('sql', 'sqlfluff.cfg')));
    expect(exists).toBe(true);
});

test.each([
    ['', true],
    ['Yes', true],
    ['n', false],
    ['maybe', false],
])('init writes gspot.toml only when you confirm the plan (answer %p)', async (answer, written) => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    using _terminal = fakeTerminalAnswers([`${answer}\n`]);
    const result = await runGspot(sandbox.path, ['init']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(written);
});

test('init writes nothing and says Canceled. Nothing was written. when the input ends before an answer', async () => {
    await using sandbox = await testdir({ 'README.md': '# Example\n' });
    commitAll(sandbox.path);
    using _terminal = fakeTerminalAnswers([]);
    const refused = await runGspot(sandbox.path, ['init']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('Continue? [Y/n] Canceled. Nothing was written.\n');
    expect(await isOnDisk(join(sandbox.path, 'gspot.toml'))).toBe(false);
});

function fakeTerminalAnswers(lines: Iterable<string> | AsyncIterable<string>): DisposableStack {
    const resources = new DisposableStack();
    resources.use(
        fakeTerminals([
            [process.stdin, true],
            [process.stderr, true],
        ]),
    );
    const createLines = readline.createInterface;
    resources.use(
        spyOn(readline, 'createInterface').mockImplementation(() => createLines({ input: Readable.from(lines) })),
    );
    return resources;
}
