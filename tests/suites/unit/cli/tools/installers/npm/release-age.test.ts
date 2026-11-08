import { readFile } from 'node:fs/promises';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import { prepareReleaseAge, writeBunReleaseAge } from '#cli/tools/installers/npm/release-age.ts';

test('a Bun run reads the release age from the bunfig.toml that it gets with --config', async () => {
    await using sandbox = await testdir();
    const hold = prepareReleaseAge(['install', '--lockfile-only'], { name: 'bun', version: '1.4.3' }, 7);
    expect(hold).toStrictEqual(['install', '--lockfile-only']);
    const path = writeBunReleaseAge(sandbox.path, 7);
    const contents = Bun.TOML.parse(await readFile(path, 'utf8'));
    expect(contents).toStrictEqual({
        install: {
            peer: false,
            minimumReleaseAge: 604_800,
            minimumReleaseAgeExcludes: ['@gspothq/cli', '@gspothq/eslint-plugin'],
        },
    });
});

test.each(['--lockfile-only'])(
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
