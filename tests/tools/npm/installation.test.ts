import { fileURLToPath } from 'node:url';
import { createFileTree } from 'testdirs';
import { join, dirname } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { runGspot } from '#tests/harness/gspot.ts';
import * as processes from '#cli/platform/spawn.ts';
import { installCommand } from '#cli/commands/install.ts';
import { installToolProject } from '#cli/tools/project.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { packageToolProject } from '#cli/tools/npm/project.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import type { InstallJson } from '#cli/types/commands/install.ts';
import { createPackageRegistry } from '#tests/harness/registry.ts';
import { rejection, containingAll } from '#tests/harness/expectations.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_REGISTRY_TOKEN } from '#tests/config/harness/registry.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';
import { cp, chmod, mkdir, unlink, readFile, writeFile } from 'node:fs/promises';

test.each(['missing', 'stale'] as const)(
    'a failed immutable npm install preserves a %s lockfile and the previous tool tree',
    async (state) => {
        await using sandbox = await createPackageProject('npm', 'package.json', 'mise');
        const installed = await installCommand({ cwd: sandbox.root, isDryRun: false });
        expect(installed.exitCode, installed.text).toBe(0);
        const { lockfilePath, lockfile, ownershipPath } = await readPackageInputs(sandbox.root, 'npm');
        const readmePath = join(sandbox.root, '.gspot/node_modules/prettier/README.md');
        const readme = await readFile(readmePath);
        if (state === 'missing') await unlink(lockfilePath);
        else {
            await chmod(lockfilePath, 0o644);
            await writeFile(lockfilePath, lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0'));
        }
        const before = state === 'missing' ? undefined : await readFile(lockfilePath);
        const ownership = await readFile(ownershipPath);
        const run = processes.run;
        const installer = spyOn(processes, 'run').mockImplementation((argv, options) => {
            if (argv[0] === 'npm' && argv[1] === 'ci')
                return Promise.resolve({
                    code: 1,
                    stdout: '',
                    stderr: 'Sample immutable install failure',
                    duration: 1,
                    missing: false,
                });
            return run(argv, options);
        });
        try {
            const failed = await installCommand({ cwd: sandbox.root, isDryRun: false });
            expect(failed.exitCode, failed.text).toBe(2);
            expect(failed.text).toContain('Sample immutable install failure');
            expect((await pathExists(lockfilePath)) ? await readFile(lockfilePath) : undefined).toStrictEqual(before);
            expect(await readFile(readmePath)).toStrictEqual(readme);
            expect(await readFile(ownershipPath)).toStrictEqual(ownership);
        } finally {
            installer.mockRestore();
        }
        const repaired = await installCommand({ cwd: sandbox.root, isDryRun: false });
        expect(repaired.exitCode, repaired.text).toBe(0);
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        expect(await readFile(readmePath)).toStrictEqual(readme);
    },
);

test('explicit lockfile refresh installs changed package bytes at the same version and its preview writes nothing', async () => {
    await using sandbox = await createPackageProject('npm', 'package.json', 'mise');
    const installed = await installCommand({ cwd: sandbox.root, isDryRun: false });
    expect(installed.exitCode, installed.text).toBe(0);
    const { lockfilePath, lockfile, ownershipPath, ownership } = await readPackageInputs(sandbox.root, 'npm');
    const readmePath = join(sandbox.root, '.gspot/node_modules/prettier/README.md');
    const original = await readFile(readmePath, 'utf8');
    const changedSource = join(sandbox.artifacts, 'updated-package');
    await cp(dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))), changedSource, { recursive: true });
    const changed = `${original}\nFixture package bytes changed at the same version.\n`;
    await writeFile(join(changedSource, 'README.md'), changed);
    await mkdir(join(sandbox.artifacts, 'updated-registry'));
    await using registry = await createPackageRegistry(join(sandbox.artifacts, 'updated-registry'), {
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
    await createFileTree(sandbox.root, {
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${PACKAGE_REGISTRY_TOKEN}\n`,
    });
    const preview = await runGspot(sandbox.root, ['install', '--refresh-lockfiles', '--dry-run', '--json']);
    expect(preview.code, preview.stdout + preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout) as InstallJson).toMatchObject({
        dryRun: true,
        steps: containingAll<string[]>([containingAll<string>(['--package-lock-only'])]),
    });
    expect({
        lockfile: await readFile(lockfilePath),
        readme: await readFile(readmePath, 'utf8'),
        ownership: await readFile(ownershipPath),
    }).toStrictEqual({ lockfile, readme: original, ownership });
    const immutable = await runGspot(sandbox.root, ['install', '--json']);
    expect(immutable.code, immutable.stdout + immutable.stderr).toBe(2);
    expect(immutable.stdout + immutable.stderr).toContain('Integrity checksum failed');
    expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
    expect(await readFile(readmePath, 'utf8')).toBe(original);
    const refreshed = await runGspot(sandbox.root, ['install', '--refresh-lockfiles', '--json']);
    expect(refreshed.code, refreshed.stdout + refreshed.stderr).toBe(0);
    expect(await readFile(lockfilePath)).not.toStrictEqual(lockfile);
    expect(await readFile(readmePath, 'utf8')).toBe(changed);
    expect(
        JSON.parse(await readFile(join(sandbox.root, '.gspot/node_modules/prettier/package.json'), 'utf8')),
    ).toHaveProperty('version', prettierManifest.version);
});

test.each(['missing', 'stale'] as const)(
    'direct package installation refuses a %s lockfile without publishing a tree',
    async (state) => {
        await using sandbox = await createPackageProject('npm', 'package.json', 'mise');
        const installed = await installCommand({ cwd: sandbox.root, isDryRun: false });
        expect(installed.exitCode, installed.text).toBe(0);
        using log = openOwnership(sandbox.root);
        const { lockfilePath, lockfile, ownershipPath, ownership } = await readPackageInputs(sandbox.root, 'npm');
        if (state === 'missing') await unlink(lockfilePath);
        else {
            await chmod(lockfilePath, 0o644);
            await writeFile(lockfilePath, lockfile.toString('utf8').replaceAll(prettierManifest.version, '0.0.0'));
        }
        const staged: string[] = [];
        expect(
            await rejection(
                installToolProject(
                    packageToolProject,
                    {
                        read: log.files.read.bind(log.files),
                        installTree: (_kind, directory) => {
                            staged.push(directory);
                        },
                    },
                    { root: sandbox.root, tools: sandbox.tools },
                ),
            ),
        ).toContain('Run: gspot apply, then gspot install');
        expect(staged).toStrictEqual([]);
        expect(await readFile(join(sandbox.root, '.gspot/node_modules/prettier/package.json'), 'utf8')).toContain(
            prettierManifest.version,
        );
        expect(await readFile(ownershipPath)).toStrictEqual(ownership);
    },
);
