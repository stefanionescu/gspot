import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { isOnDisk } from '#tests/setup/files.ts';
import { LOCKFILE_ARGUMENTS } from '#cli/config/install/npm.ts';
import { OWN_PACKAGES } from '#tests/data/checks/dependencies.ts';
import { prepareReleaseAge } from '#cli/install/npm/release-age.ts';

test('an npm tool lockfile gets the hold as flags and writes no file', async () => {
    await using folder = await testdir();
    const hold = prepareReleaseAge(folder.path, LOCKFILE_ARGUMENTS.npm, { name: 'npm', version: '11.19.0' }, 7);
    expect(hold).toStrictEqual([
        ...LOCKFILE_ARGUMENTS.npm,
        '--min-release-age=7',
        ...OWN_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
    ]);
});

test('a Bun tool lockfile reads the hold from a bunfig.toml in its folder', async () => {
    await using folder = await testdir();
    const hold = prepareReleaseAge(folder.path, LOCKFILE_ARGUMENTS.bun, { name: 'bun', version: '1.4.3' }, 7);
    expect(hold).toStrictEqual([...LOCKFILE_ARGUMENTS.bun]);
    expect(Bun.TOML.parse(await readFile(join(folder.path, 'bunfig.toml'), 'utf8'))).toStrictEqual({
        install: { minimumReleaseAge: 604_800, minimumReleaseAgeExcludes: [...OWN_PACKAGES] },
    });
});

test('a pnpm tool lockfile reads the hold from pnpm-workspace.yaml', async () => {
    await using folder = await testdir();
    const hold = prepareReleaseAge(folder.path, LOCKFILE_ARGUMENTS.pnpm, { name: 'pnpm', version: '10.30.0' }, 7);
    expect(hold).toStrictEqual([...LOCKFILE_ARGUMENTS.pnpm]);
    expect(Bun.YAML.parse(await readFile(join(folder.path, 'pnpm-workspace.yaml'), 'utf8'))).toStrictEqual({
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: [...OWN_PACKAGES],
    });
});

test('a Yarn tool lockfile keeps its command; its hold goes into the install settings file', async () => {
    await using folder = await testdir();
    const command = ['yarn', 'install', '--immutable'];
    expect(prepareReleaseAge(folder.path, command, { name: 'yarn', version: '4.14.1' }, 7)).toStrictEqual(command);
    expect(await isOnDisk(join(folder.path, 'bunfig.toml'))).toBe(false);
});
