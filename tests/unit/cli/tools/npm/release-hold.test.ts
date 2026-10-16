import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/files.ts';
import { LOCKFILE_ARGUMENTS } from '#cli/config/tools/npm.ts';
import { OWN_PACKAGES } from '#tests/data/checks/dependencies.ts';
import { addToolReleaseHold } from '#cli/tools/npm/release-hold.ts';

test('an npm tool install gets the hold as flags and writes no file', async () => {
    await using folder = await testdir();
    const hold = addToolReleaseHold(folder.path, LOCKFILE_ARGUMENTS.npm, { name: 'npm', version: '11.19.0' }, 7);
    expect(hold).toStrictEqual({
        command: [
            ...LOCKFILE_ARGUMENTS.npm,
            '--min-release-age=7',
            ...OWN_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
        ],
        written: undefined,
    });
});

test('a Bun tool install reads the hold from a bunfig.toml in its folder', async () => {
    await using folder = await testdir();
    const hold = addToolReleaseHold(folder.path, LOCKFILE_ARGUMENTS.bun, { name: 'bun', version: '1.4.3' }, 7);
    expect(hold).toStrictEqual({ command: [...LOCKFILE_ARGUMENTS.bun], written: 'bunfig.toml' });
    expect(Bun.TOML.parse(await readFile(join(folder.path, 'bunfig.toml'), 'utf8'))).toStrictEqual({
        install: { minimumReleaseAge: 604_800, minimumReleaseAgeExcludes: [...OWN_PACKAGES] },
    });
});

test('a pnpm tool install reads the hold from pnpm-workspace.yaml, so it stops ignoring that file', async () => {
    await using folder = await testdir();
    const hold = addToolReleaseHold(folder.path, LOCKFILE_ARGUMENTS.pnpm, { name: 'pnpm', version: '10.30.0' }, 7);
    expect(hold).toStrictEqual({
        command: LOCKFILE_ARGUMENTS.pnpm.filter((part) => part !== '--ignore-workspace'),
        written: 'pnpm-workspace.yaml',
    });
    expect(Bun.YAML.parse(await readFile(join(folder.path, 'pnpm-workspace.yaml'), 'utf8'))).toStrictEqual({
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: [...OWN_PACKAGES],
    });
});

test('a Yarn tool install keeps its command; its hold goes into the install settings file', async () => {
    await using folder = await testdir();
    const command = ['yarn', 'install', '--immutable'];
    expect(addToolReleaseHold(folder.path, command, { name: 'yarn', version: '4.14.1' }, 7)).toStrictEqual({
        command,
        written: undefined,
    });
    expect(await isOnDisk(join(folder.path, 'bunfig.toml'))).toBe(false);
});
