// Planted repository for the dependencies preset: a version range, a second package manager, a public workspace root, a stale lockfile.
import { join } from 'node:path';
import { createFixture } from 'fs-fixture';
import type { PlantedCase } from '#types/run.ts';
import { describe, expect, test } from 'bun:test';
import { commitAll, install, PLANTED_TIMEOUT_MS, run, runPlanted, toolsPath } from '#tests/harness/planted.ts';

const INIT = [
    'init',
    '--yes',
    '--presets',
    'dependencies',
    '--runner',
    'none',
    '--ci',
    'none',
    '--hooks',
    'none',
    '--no-rules',
    '--no-install',
];
const CLEAN =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.3.11"\n}\n';
const RANGED =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "private": true,\n    "packageManager": "bun@1.3.11",\n    "dependencies": {\n        "left-pad": "^1.3.0"\n    }\n}\n';
const PUBLIC_ROOT =
    '{\n    "name": "planted",\n    "version": "1.0.0",\n    "packageManager": "bun@1.3.11",\n    "workspaces": ["packages/*"]\n}\n';

// The scheme arrives as an argument, because a fixer rewrites a plain-text URL without TLS into one with it.
function lockfileFrom(scheme: string): string {
    return `{\n    "packages": { "node_modules/a": { "resolved": "${scheme}://registry.example.test/a/-/a-1.0.0.tgz" } }\n}\n`;
}

const CASES: PlantedCase[] = [
    {
        id: 'integrity/manifest-policy',
        files: { 'package.json': '{' },
        expected: 'Cannot read package manifest package.json',
    },
    {
        id: 'integrity/manifest-policy',
        files: { 'package.json': '{"dependencies":{"example":false}}' },
        expected: 'Cannot read package manifest package.json',
    },
    {
        id: 'integrity/install-policy',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 3600\n' },
        expected: 'the policy asks for 604800 seconds',
    },
    {
        id: 'integrity/install-policy',
        files: { 'bun.lock': '{}\n', 'bunfig.toml': '[install]\nminimumReleaseAge = 604800\n' },
        policy: '[tools.install]\nsecurity_scanner = "@socketsecurity/bun-security-scanner"\n',
        expected: 'scanner is not @socketsecurity/bun-security-scanner',
    },
    {
        id: 'integrity/lockfile-hosts',
        files: {
            'package-lock.json': lockfileFrom('http'),
        },
        expected: 'is not HTTPS',
    },
    {
        id: 'integrity/lockfile-hosts',
        files: {
            'package-lock.json': lockfileFrom('https'),
        },
        expected: 'registry.example.test is not an allowed registry host',
    },
    {
        id: 'integrity/manifest-policy',
        files: { 'package.json': RANGED },
        expected: 'left-pad is "^1.3.0" under dependencies',
    },
    {
        id: 'integrity/manifest-policy',
        files: { 'package.json': PUBLIC_ROOT },
        expected: 'A workspace root is private',
    },
    {
        id: 'integrity/manifest-policy',
        files: { 'bun.lock': '{}\n', 'package-lock.json': '{}\n' },
        expected: 'lockfiles of 2 package managers',
    },
];

describe('the dependencies preset', () => {
    test(
        'the manifest policy and the lockfile check fire on their planted defects, and the advisory lookup waits for the network',
        async () => {
            await using fixture = await createFixture({ 'package.json': CLEAN });
            commitAll(fixture.path);
            const environment = { PATH: toolsPath(['typos', 'ec']) };
            await install(fixture.path, INIT, environment);
            const manifest = await run(fixture.path, ['check', 'integrity/manifest-policy', '--no-cache'], environment);
            expect(manifest.code).toBe(0);
            for (const planted of CASES) {
                const outcome = await runPlanted(fixture.path, planted, environment);
                expect(outcome.code, `${planted.id}: ${outcome.stdout}`).toBe(1);
                expect(outcome.stdout, planted.id).toContain(planted.expected);
            }
            await Bun.write(
                join(fixture.path, 'package.json'),
                RANGED.replace('^1.3.0', () => '1.3.0'),
            );
            await Bun.write(
                join(fixture.path, 'bun.lock'),
                '{\n  "lockfileVersion": 1,\n  "workspaces": { "": { "name": "planted" } },\n  "packages": {}\n}\n',
            );
            const stale = await run(fixture.path, ['check', 'integrity/lockfile-fresh', '--no-cache'], environment);
            expect(stale.code, stale.stdout).toBe(1);
            expect(stale.stdout).toContain('refuses this lockfile');
            const checked = await run(fixture.path, ['check', '--at', 'commit', '--json'], environment);
            const atCommit = JSON.parse(checked.stdout) as {
                checks: { id: string }[];
            };
            const ids = atCommit.checks.map((check) => check.id);
            expect(ids).not.toContain('dependencies/osv');
            expect(ids).not.toContain('dependencies/syncpack');
        },
        PLANTED_TIMEOUT_MS * 2,
    );
});
