import * as fs from 'node:fs';
import { join } from 'node:path';
import * as clack from '@clack/prompts';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import type { InitJson } from '#cli/types/commands/init.ts';
import { rm, stat, readFile, writeFile } from 'node:fs/promises';
import { EDITED_STYLELINT_PACKAGE } from '#tests/data/commands/init.ts';
import { simulateInteractiveTerminal } from '#tests/setup/environment.ts';
import { INVALID_CSS, STYLELINT_PACKAGE_JSON } from '#tests/data/checks/css.ts';

test.each([
    [
        'changes',
        async (path: string) => {
            await writeFile(path, 'disable=SC2034\n');
        },
    ],
    ['vanishes', rm],
])('init refuses to delete a replaced file that %s after the plan', async (kind, change) => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({ '.shellcheckrc': 'disable=SC2086\n', 'entry.sh': 'echo example\n' });

    commitAll(sandbox.path);

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'bash', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.delete.map((entry) => entry.path)).toContain('.shellcheckrc');
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await change(join(sandbox.path, '.shellcheckrc'));
            return true;
        }),
    );
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'bash']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe('.shellcheckrc changed before removal. Run the command again.\n');
    if (kind === 'changes')
        expect(await readFile(join(sandbox.path, '.shellcheckrc'), 'utf8')).toBe('disable=SC2034\n');
    else expect(await isOnDisk(join(sandbox.path, '.shellcheckrc'))).toBe(false);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(
        (JSON.parse(preview.stdout) as InitJson).settings,
    );
    expect(await isOnDisk(join(sandbox.path, '.gspot/version'))).toBe(true);
});

test('a failed init keeps the ordinary generated files already written', async () => {
    await using folder = await testdir({ '.gspot/version': '0.0.1\n' });

    commitAll(folder.path);
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(folder.path, '.gitattributes')) throw new Error('Generated write denied');
        rename(source, target);
    });

    const refused = await runGspot(folder.path, ['init', '--yes', '--no-configurations']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(folder.path, '.gspot/version'), 'utf8')).toBe(`${cliPackage.version}\n`);
});

test('init keeps the old tool file when the generated one cannot be written', async () => {
    await using sandbox = await testdir();
    const authored = '[default.extend-words]\nAuthored = "Authored"\n';
    await createFileTree(sandbox.path, { 'typos.toml': authored });
    const rename = fs.renameSync;
    using _publication = spyOn(fs, 'renameSync').mockImplementation((source, target) => {
        if (String(target) === join(sandbox.path, '.gspot/configurations/general/spelling/typos.toml'))
            throw new Error('Generated write denied');
        rename(source, target);
    });
    const refused = await runGspot(sandbox.path, ['init', '--yes', '--configurations', 'spelling']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Generated write denied. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(sandbox.path, 'typos.toml'), 'utf8')).toBe(authored);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/general/spelling/typos.toml'))).toBe(false);
});

test('init refuses to write package.json when one of its managed fields changed after the plan, and keeps its bytes and mode', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({ 'package.json': STYLELINT_PACKAGE_JSON, 'source.css': INVALID_CSS });

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'css', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.change).toContainEqual({ path: 'package.json', note: 'managed stylelint fields; other content stays' });
    expect(plan.delete.some((entry) => entry.path === 'package.json')).toBe(false);
    let mode = 0;
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'package.json'), EDITED_STYLELINT_PACKAGE);
            const fileAttributes = await stat(join(sandbox.path, 'package.json'));
            mode = fileAttributes.mode;
            return true;
        }),
    );
    const refused = await runGspot(sandbox.path, ['init', '--configurations', 'css']);
    expect(refused.code).toBe(2);
    expect(refused.stderr).toBe(
        'gspot stopped because of an internal error: Destination changed during the operation: package.json. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.\n',
    );
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(EDITED_STYLELINT_PACKAGE);
    const after = await stat(join(sandbox.path, 'package.json'));
    expect(after.mode & 0o777).toBe(mode & 0o777);
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(
        (JSON.parse(preview.stdout) as InitJson).settings,
    );
    expect(await isOnDisk(join(sandbox.path, '.gspot/version'))).toBe(true);
});

test('init keeps a shared file that was edited after the plan', async () => {
    using mockResources = new DisposableStack();
    await using sandbox = await testdir({
        'setup.cfg': '[sqlfluff]\nexclude_rules = LT01\n',
        'query.sql': 'SELECT 1;\n',
    });

    const preview = await runGspot(sandbox.path, ['init', '--yes', '--dry-run', '--configurations', 'sql', '--json']);
    const plan = (JSON.parse(preview.stdout) as InitJson).plan;
    expect(plan.retained).toContainEqual({
        path: 'setup.cfg',
        note: expect.stringContaining('Delete the section when ready') as string,
    });
    const edited = `[sqlfluff]
exclude_rules = LT01, RF01
[flake8]
ignore = E501
`;
    await using _terminal = await simulateInteractiveTerminal();
    mockResources.use(
        spyOn(clack, 'confirm').mockImplementation(async () => {
            await writeFile(join(sandbox.path, 'setup.cfg'), edited);
            return true;
        }),
    );
    const written = await runGspot(sandbox.path, ['init', '--configurations', 'sql']);
    expect(written.code, written.stdout + written.stderr).toBe(0);
    expect(await readFile(join(sandbox.path, 'setup.cfg'), 'utf8')).toBe(edited);
    expect(await isOnDisk(join(sandbox.path, '.gspot/configurations/language/sql/sqlfluff.cfg'))).toBe(true);
});
