import { fileURLToPath } from 'node:url';
import { createFileTree } from 'testdirs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import * as processes from '#cli/platform/spawn.ts';
import { installCommand } from '#cli/commands/install.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { installPackageProject } from '#cli/tools/npm/project.ts';
import { createPackageRegistry } from '#tests/harness/registry.ts';
import { rejection, containingAll } from '#tests/harness/expectations.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';
import { cpSync, chmodSync, mkdirSync, existsSync, unlinkSync, readFileSync, writeFileSync } from 'node:fs';

test.each(['missing', 'stale'] as const)(
    'a failed immutable npm install preserves a %s lockfile and the previous tool tree',
    async (state) => {
        await using fixture = await createPackageProject('npm', 'package.json', 'mise');
        const installed = await installCommand({ cwd: fixture.root, isDryRun: false });
        expect(installed.exitCode, installed.text).toBe(0);
        const { lockfilePath, lockfile, ownershipPath } = readPackageInputs(fixture.root, 'npm');
        const readmePath = join(fixture.root, '.gspot/node_modules/prettier/README.md');
        const readme = readFileSync(readmePath);
        if (state === 'missing') unlinkSync(lockfilePath);
        else {
            chmodSync(lockfilePath, 0o644);
            writeFileSync(lockfilePath, lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0'));
        }
        const before = state === 'missing' ? undefined : readFileSync(lockfilePath);
        const ownership = readFileSync(ownershipPath);
        const run = processes.run;
        const installer = spyOn(processes, 'run').mockImplementation((argv, options) => {
            if (argv[0] === 'npm' && argv[1] === 'ci')
                return Promise.resolve({
                    code: 1,
                    stdout: '',
                    stderr: 'Fixture immutable install failure',
                    duration: 1,
                    missing: false,
                });
            return run(argv, options);
        });
        try {
            const failed = await installCommand({ cwd: fixture.root, isDryRun: false });
            expect(failed.exitCode, failed.text).toBe(2);
            expect(failed.text).toContain('Fixture immutable install failure');
            expect(existsSync(lockfilePath) ? readFileSync(lockfilePath) : undefined).toStrictEqual(before);
            expect(readFileSync(readmePath)).toStrictEqual(readme);
            expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
        } finally {
            installer.mockRestore();
        }
        const repaired = await installCommand({ cwd: fixture.root, isDryRun: false });
        expect(repaired.exitCode, repaired.text).toBe(0);
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
        expect(readFileSync(readmePath)).toStrictEqual(readme);
    },
);

test('explicit lockfile refresh installs changed package bytes at the same version and its preview writes nothing', async () => {
    await using fixture = await createPackageProject('npm', 'package.json', 'mise');
    const installed = await installCommand({ cwd: fixture.root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const { lockfilePath, lockfile, ownershipPath, ownership } = readPackageInputs(fixture.root, 'npm');
    const readmePath = join(fixture.root, '.gspot/node_modules/prettier/README.md');
    const original = readFileSync(readmePath, 'utf8');
    const changedSource = join(fixture.artifacts, 'updated-package');
    cpSync(dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))), changedSource, { recursive: true });
    const changed = `${original}\nFixture package bytes changed at the same version.\n`;
    writeFileSync(join(changedSource, 'README.md'), changed);
    mkdirSync(join(fixture.artifacts, 'updated-registry'));
    await using registry = await createPackageRegistry(join(fixture.artifacts, 'updated-registry'), {
        declarations: [
            {
                name: prettierManifest.name,
                source: changedSource,
                version: prettierManifest.version,
                bin: { prettier: prettierManifest.bin },
            },
        ],
        execute: runTestCommand,
        token: PACKAGE_REGISTRY_TOKEN,
    });
    await createFileTree(fixture.root, {
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${PACKAGE_REGISTRY_TOKEN}\n`,
    });
    const preview = await runGspot(fixture.root, ['install', '--refresh-lockfiles', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout) as InstallJson).toMatchObject({
        dryRun: true,
        steps: containingAll<string[]>([containingAll<string>(['--package-lock-only'])]),
    });
    expect({
        lockfile: readFileSync(lockfilePath),
        readme: readFileSync(readmePath, 'utf8'),
        ownership: readFileSync(ownershipPath),
    }).toStrictEqual({ lockfile, readme: original, ownership });
    const immutable = await runGspot(fixture.root, ['install', '--json']);
    expect(immutable.code, immutable.stdout + immutable.stderr).toBe(2);
    expect(immutable.stdout + immutable.stderr).toContain('Integrity checksum failed');
    expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
    expect(readFileSync(readmePath, 'utf8')).toBe(original);
    const refreshed = await runGspot(fixture.root, ['install', '--refresh-lockfiles', '--json']);
    expect(refreshed.code, refreshed.stdout + refreshed.stderr).toBe(0);
    expect(readFileSync(lockfilePath)).not.toStrictEqual(lockfile);
    expect(readFileSync(readmePath, 'utf8')).toBe(changed);
    expect(
        JSON.parse(readFileSync(join(fixture.root, '.gspot/node_modules/prettier/package.json'), 'utf8')),
    ).toHaveProperty('version', prettierManifest.version);
});

test.each(['missing', 'stale'] as const)(
    'direct package installation refuses a %s lockfile without publishing a tree',
    async (state) => {
        await using fixture = await createPackageProject('npm', 'package.json', 'mise');
        using log = openOwnership(fixture.root);
        const { lockfilePath, lockfile, ownershipPath, ownership } = readPackageInputs(fixture.root, 'npm');
        if (state === 'missing') unlinkSync(lockfilePath);
        else {
            chmodSync(lockfilePath, 0o644);
            writeFileSync(lockfilePath, lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0'));
        }
        const staged: string[] = [];
        const { tools } = fixture;
        expect(
            await rejection(
                installPackageProject(
                    fixture.root,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, directory) => {
                            staged.push(directory);
                        },
                    },
                    tools,
                ),
            ),
        ).toContain('Run: gspot apply, then gspot install');
        expect(staged).toStrictEqual([]);
        expect(readFileSync(join(fixture.root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
            prettierManifest.version,
        );
        expect(readFileSync(ownershipPath)).toStrictEqual(ownership);
    },
);
