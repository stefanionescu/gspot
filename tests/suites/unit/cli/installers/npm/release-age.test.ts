import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { PACKAGE_MANAGER_ARGUMENTS } from '#cli/config/installers/npm/project.ts';
import { MINIMUM_RELEASE_AGE } from '#tests/config/installers/npm/release-age.ts';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/installers/npm/release-age.ts';

test('an npm tool lockfile gets the minimum release age as flags and writes no file', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
        { name: 'npm', version: '11.19.0' },
        MINIMUM_RELEASE_AGE,
    );
    expect(hold).toStrictEqual([
        ...PACKAGE_MANAGER_ARGUMENTS.npm.lockfile,
        '--min-release-age=7',
        ...MINIMUM_RELEASE_AGE.npmExclusions.map((name) => `--min-release-age-exclude=${name}`),
    ]);
});

test('a Bun run reads the release age from the bunfig.toml that it gets with --config', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.bun.lockfile,
        { name: 'bun', version: '1.4.3' },
        MINIMUM_RELEASE_AGE,
    );
    expect(hold).toStrictEqual([...PACKAGE_MANAGER_ARGUMENTS.bun.lockfile]);
    expect(await readdir(sandbox.path)).toStrictEqual([]);
    const path = writeBunReleaseAge(sandbox.path, MINIMUM_RELEASE_AGE);
    expect(path).toBe(join(sandbox.path, 'bunfig.toml'));
    const contents = Bun.TOML.parse(await readFile(path, 'utf8'));
    expect(contents).toStrictEqual({
        install: {
            peer: false,
            minimumReleaseAge: 604_800,
            minimumReleaseAgeExcludes: MINIMUM_RELEASE_AGE.npmExclusions,
        },
    });
});

test('a pnpm tool lockfile reads the hold from pnpm-workspace.yaml', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        PACKAGE_MANAGER_ARGUMENTS.pnpm.lockfile,
        { name: 'pnpm', version: '10.30.0' },
        MINIMUM_RELEASE_AGE,
    );
    expect(hold).toStrictEqual([...PACKAGE_MANAGER_ARGUMENTS.pnpm.lockfile]);
    const contents = Bun.YAML.parse(await readFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'utf8'));
    expect(contents).toStrictEqual({
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: MINIMUM_RELEASE_AGE.npmExclusions,
    });
});

test('a Yarn tool lockfile keeps its command and writes no settings file', async () => {
    await using sandbox = await testdir();
    const command = ['yarn', 'install', '--immutable'];
    expect(
        prepareReleaseAge(sandbox.path, command, { name: 'yarn', version: '4.14.1' }, MINIMUM_RELEASE_AGE),
    ).toStrictEqual(command);
    expect(await readdir(sandbox.path)).toStrictEqual([]);
});
