import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { prepareReleaseAge, writeBunReleaseAge } from '#cli/tools/installers/npm/release-age.ts';

test('an npm tool lockfile gets the minimum release age as flags and writes no file', () => {
    const hold = prepareReleaseAge(['install', '--package-lock-only'], { name: 'npm', version: '11.19.0' }, 7);
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
    const hold = prepareReleaseAge(['install', '--lockfile-only'], { name: 'bun', version: '1.4.3' }, 7);
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

test.each(['--lockfile-only', '--frozen-lockfile'])(
    'a pnpm install %s gets the minimum release age and the gspot exclusions as flags',
    (flag) => {
        expect(prepareReleaseAge(['install', flag], { name: 'pnpm', version: '11.28.10' }, 7)).toStrictEqual([
            'install',
            flag,
            '--config.minimum-release-age=10080',
            '--config.minimum-release-age-exclude=@gspothq/cli',
            '--config.minimum-release-age-exclude=@gspothq/eslint-plugin',
        ]);
    },
);
