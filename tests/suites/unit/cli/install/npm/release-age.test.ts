import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { OWN_PACKAGES } from '#tests/config/install/npm/release-age.ts';
import { PACKAGE_MANAGER_ARGUMENTS } from '#cli/config/install/npm/project.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/install/npm/release-age.ts';

test('an npm tool lockfile gets the minimum release age as flags and writes no file', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
        { name: 'npm', version: '11.19.0' },
        7,
    );
    expect(hold).toStrictEqual([
        ...PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
        '--min-release-age=7',
        ...OWN_PACKAGES.map((name) => `--min-release-age-exclude=${name}`),
    ]);
});

test('a Bun run reads the release age from the bunfig.toml that it gets with --config', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.bun.lockfile,
        { name: 'bun', version: '1.4.3' },
        7,
    );
    expect(hold).toStrictEqual([...PACKAGE_MANAGER_ARGUMENTS.bun.lockfile]);
    expect(await readdir(sandbox.path)).toStrictEqual([]);
    const path = writeBunReleaseAge(sandbox.path, 7);
    expect(path).toBe(join(sandbox.path, 'bunfig.toml'));
    const contents = Bun.TOML.parse(await readFile(path, 'utf8'));
    expect(contents).toStrictEqual({
        install: { peer: false, minimumReleaseAge: 604_800, minimumReleaseAgeExcludes: [...OWN_PACKAGES] },
    });
});

test('a pnpm tool lockfile reads the hold from pnpm-workspace.yaml', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.pnpm.lockfile,
        { name: 'pnpm', version: '10.30.0' },
        7,
    );
    expect(hold).toStrictEqual([...PACKAGE_MANAGER_ARGUMENTS.pnpm.lockfile]);
    const contents = Bun.YAML.parse(await readFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'utf8'));
    expect(contents).toStrictEqual({
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: [...OWN_PACKAGES],
    });
});

test('a Yarn tool lockfile keeps its command and writes no settings file', async () => {
    await using sandbox = await testdir();
    const command = ['yarn', 'install', '--immutable'];
    expect(prepareReleaseAge(sandbox.path, command, { name: 'yarn', version: '4.14.1' }, 7)).toStrictEqual(command);
    expect(await readdir(sandbox.path)).toStrictEqual([]);
});
