import { test, expect } from 'bun:test';
import { npmProject } from '#cli/generation/npm.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import { installArgv, lockfileArgv, githubRefusalNote } from '#cli/tools/npm/install.ts';
import { YARN_MANAGERS, OTHER_DOWNLOAD_OUTPUT, GITHUB_DOWNLOAD_FAILURES } from '#tests/config/cli/tools/npm/install.ts';

test.each(GITHUB_DOWNLOAD_FAILURES)('a refused GitHub download names the token to set: %s', (line) => {
    expect(githubRefusalNote(`postinstall failed\n${line}\n`)).toContain('GITHUB_TOKEN');
});

test.each(OTHER_DOWNLOAD_OUTPUT)('output without a refused GitHub download adds no token note: %s', (output) => {
    expect(githubRefusalNote(output)).toBeUndefined();
});

test.each(YARN_MANAGERS)(
    'Yarn $installer.version selects compatible generated settings and native lockfile creation',
    ({ installer, lockfile, install, settings }) => {
        expect(lockfileArgv(installer)).toStrictEqual(lockfile);
        expect(installArgv(installer)).toStrictEqual(install);
        const files = npmProject([], installer, 'mise');
        expect(files.map((file) => file.path)).toStrictEqual(
            settings ? ['.gspot/package.json', '.gspot/.yarnrc.yml'] : ['.gspot/package.json'],
        );
        expect(parsePackageManifest(files[0]!.content).packageManager).toBe(`yarn@${installer.version}`);
        if (settings) expect(files[1]!.content).toBe('nodeLinker: node-modules\nenableGlobalCache: true\n');
    },
);
