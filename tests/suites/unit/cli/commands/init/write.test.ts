import * as fs from 'node:fs';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { test, spyOn, expect } from 'bun:test';
import { GspotError } from '#cli/system/errors.ts';
import { testdir, createFileTree } from 'testdirs';
import { commitAll } from '#tests/setup/system/git.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import * as installers from '#cli/tools/installers/install.ts';
import { EMPTY_TOOL_INSTALL } from '#tests/config/setup/sandboxes.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { STOPPED_ERROR_MESSAGE, GENERATED_WRITE_MESSAGE } from '#tests/config/generation/plan.ts';

test('init keeps the old config file when the generated one cannot be written', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
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
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'spelling']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(STOPPED_ERROR_MESSAGE);
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    const generated = join(sandbox.path, getManifestTarget('spelling', 'typos.toml'));
    expect(existsSync(generated)).toBe(false);
});

test.each([
    {
        name: 'a package.json without a pin needs the install of the package manager',
        manifest: '{"name":"example","private":true}\n',
        next: 'Next: run npm install to install the gspot that package.json now pins, then gspot check --fix, then gspot baseline.',
    },
    {
        name: 'a repository with a pin goes on to gspot check --fix',
        manifest: `{"name":"example","private":true,"devDependencies":{"${cliPackage.name}":"${cliPackage.version}"}}\n`,
        next: 'Next: gspot check --fix, then gspot baseline.',
    },
])('the last line of init: $name', async ({ manifest, next }) => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'package.json': manifest });
    const result = await runGspot(sandbox.path, ['init', '--no-configurations']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trimEnd().split('\n').at(-1)).toBe(next);
});

test('init writes the generated files, then installs the tools of the plan', async () => {
    await using sandbox = await createGitSandbox({ 'entry.sh': 'echo example\n' });
    using _commands = fakeCommands(undefined, (command) => {
        if (command[1] === 'lock') throw new GspotError('install', 'The test stops at the first tool.');
        return Promise.resolve(buildProcessResult({ stdout: '11.19.0\n' }));
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'bash', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ error: 'install', message: 'The test stops at the first tool.' });
    const shellcheck = join(sandbox.path, getManifestTarget('bash', 'shellcheckrc'));
    expect(existsSync(shellcheck)).toBe(true);
});

test('init keeps a shared file that was edited after the plan', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, 'gspot.toml'))
            fs.writeFileSync(join(sandbox.path, 'setup.cfg'), edited);
        rename(source, target);
    });
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    const generated = join(sandbox.path, getManifestTarget('sql', 'sqlfluff.cfg'));
    expect(existsSync(generated)).toBe(true);
});

test('init keeps a replaced config that changes after the plan reads it', async () => {
    using _install = spyOn(installers, 'installTools').mockResolvedValue(EMPTY_TOOL_INSTALL);
    await using sandbox = await createGitSandbox({ 'typos.toml': '[default.extend-words]\nAuthored = "Authored"\n' });
    commitAll(sandbox.path);
    const edited = '[default.extend-words]\nChanged = "Changed"\n';
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, 'gspot.toml'))
            fs.writeFileSync(join(sandbox.path, 'typos.toml'), edited);
        rename(source, target);
    });
    const result = await runGspot(sandbox.path, ['init', '--configurations', 'spelling']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(edited);
    expect(result.stdout).toContain('kept typos.toml: it changed after init read it');
});
