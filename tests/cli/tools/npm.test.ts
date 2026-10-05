import { test, expect } from 'bun:test';
import { npmProject } from '#cli/generation/npm.ts';
import { YARN_MANAGERS } from '#tests/config/cli/tools/npm.ts';
import { parsePackageManifest } from '#cli/parsers/packages.ts';
import { lockArgv, installArgv, githubRefusalNote } from '#cli/tools/npm/install.ts';

test.each([
    'error: Request to https://api.github.com/repos/editorconfig-checker/editorconfig-checker/releases/tags/v3.4.0 failed with status 403',
    'Error: HTTP 403 from https://github.com/editorconfig-checker/editorconfig-checker/releases/download/v3.4.0/ec-darwin-arm64.tar.gz',
    'API rate limit exceeded for 203.0.113.9.',
])('output that shows a GitHub refusal names the token to set: %s', (line) => {
    expect(githubRefusalNote(`postinstall failed\n${line}\n`)).toContain('GITHUB_TOKEN');
});

test('output without a known cause adds no note', () => {
    expect(githubRefusalNote('error: package "left-pad@0.0.1" not found\n')).toBeUndefined();
    expect(githubRefusalNote('')).toBeUndefined();
});

test.each(YARN_MANAGERS)(
    'Yarn $installer.version selects compatible generated settings and native lock operations',
    ({ installer, lock, install, settings }) => {
        expect(lockArgv(installer)).toStrictEqual(lock);
        expect(installArgv(installer)).toStrictEqual(install);
        const files = npmProject([], installer, 'mise');
        expect(files.map((file) => file.path)).toStrictEqual(
            settings ? ['.gspot/package.json', '.gspot/.yarnrc.yml'] : ['.gspot/package.json'],
        );
        expect(parsePackageManifest(files[0]!.content).packageManager).toBe(`yarn@${installer.version}`);
        if (settings) expect(files[1]!.content).toBe('nodeLinker: node-modules\nenableGlobalCache: true\n');
    },
);
