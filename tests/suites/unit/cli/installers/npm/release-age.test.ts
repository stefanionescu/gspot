import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/installers/npm/release-age.ts';

test('an npm tool lockfile gets the minimum release age as flags and writes no file', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        ['install', '--package-lock-only'],
        { name: 'npm', version: '11.19.0' },
        7,
    );
    expect(hold).toStrictEqual([
        'install',
        '--package-lock-only',
        '--min-release-age=7',
        '--min-release-age-exclude=@gspothq/cli',
        '--min-release-age-exclude=@gspothq/eslint-plugin',
    ]);
});

test('a Bun run reads the release age from the bunfig.toml that it gets with --config', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(sandbox.path, ['install', '--lockfile-only'], { name: 'bun', version: '1.4.3' }, 7);
    expect(hold).toStrictEqual(['install', '--lockfile-only']);
    expect(await readdir(sandbox.path)).toStrictEqual([]);
    const path = writeBunReleaseAge(sandbox.path, 7);
    expect(path).toBe(join(sandbox.path, 'bunfig.toml'));
    const contents = Bun.TOML.parse(await readFile(path, 'utf8'));
    expect(contents).toStrictEqual({
        install: {
            peer: false,
            minimumReleaseAge: 604_800,
            minimumReleaseAgeExcludes: ['@gspothq/cli', '@gspothq/eslint-plugin'],
        },
    });
});

test('a pnpm tool lockfile reads the minimum release age from pnpm-workspace.yaml', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(
        sandbox.path,
        ['install', '--lockfile-only'],
        { name: 'pnpm', version: '10.30.0' },
        7,
    );
    expect(hold).toStrictEqual(['install', '--lockfile-only']);
    const contents = Bun.YAML.parse(await readFile(join(sandbox.path, 'pnpm-workspace.yaml'), 'utf8'));
    expect(contents).toStrictEqual({
        minimumReleaseAge: 10_080,
        minimumReleaseAgeExclude: ['@gspothq/cli', '@gspothq/eslint-plugin'],
    });
});
