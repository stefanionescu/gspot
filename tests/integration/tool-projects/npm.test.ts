import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import type { ApplyReport } from '#cli/types/apply.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { NPM_REGISTRY_TOKEN } from '#tests/data/test-setup.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { SETTING_DEFAULTS } from '#cli/config/settings/defaults.ts';
import { selectLockfileName } from '#cli/tools/npm/tool-project.ts';
import { readRegistryEnvironment } from '#cli/tools/npm/registry.ts';
import type { DryRunJson } from '#cli/types/commands/edit-settings.ts';
import { runGit, commitAll, readGitOutput } from '#tests/setup/git.ts';
import { TOOL_PROJECT_BYTE_ATTRIBUTES } from '#tests/data/parsers/git.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import { PACKAGE_MANAGER_ROWS } from '#tests/data/tools/npm-tool-project.ts';
import { writeLockedInputs, readToolProjectFiles } from '#tests/setup/install.ts';
import { createPackageManagerSandbox } from '#tests/setup/package-manager-sandboxes.ts';
import type { ToolProjectFiles, PackageManagerSandbox } from '#tests/types/packages.ts';
import { stat, chmod, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';

test.each(PACKAGE_MANAGER_ROWS.filter(([, path]) => path === 'package.json'))(
    '%s from %s: apply keeps a stale lockfile and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createPackageManagerSandbox(packageManager, projectPath);
        const { root, registry } = sandbox;
        await writeLockedInputs(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, packageManager);
        expect(Buffer.from(lockfile).toString('utf8')).not.toContain(NPM_REGISTRY_TOKEN);
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        }
        // Yarn 1 writes resolved package addresses into its lockfile; these must exclude the private registry.
        if (packageManager === 'yarn') expect(Buffer.from(lockfile).toString('utf8')).not.toContain(registry.url);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        await writeFile(lockfilePath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(await readFile(lockfilePath, 'utf8')).toBe(stale);
        const preview = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(preview.stdout) as DryRunJson).stale).toContainEqual({
            path: `.gspot/${selectLockfileName(packageManager)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout)).toMatchObject({ installed: true });
        expect(await readFile(lockfilePath, 'utf8')).not.toBe(stale);
        const repaired = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(repaired.stdout) as DryRunJson).stale).not.toContainEqual({
            path: `.gspot/${selectLockfileName(packageManager)}`,
            kind: 'changed',
        });
    },
);

test.each(PACKAGE_MANAGER_ROWS.filter(([, path]) => path === 'package.json'))(
    '%s from %s keeps a conflicted lockfile through apply until the packageManager pin is fixed, and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createPackageManagerSandbox(packageManager, projectPath);
        const { root, rootPackage } = sandbox;
        await writeLockedInputs(root);
        const { manifest, lockfilePath, lockfile } = await readToolProjectFiles(root, packageManager);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${Buffer.from(lockfile).toString('utf8')}\n>>>>>>> generated\n`;
        await writeFile(lockfilePath, conflict);
        await writeFile(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${packageManager}@99.0.0` }),
        );
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, '.gspot/package.json'))).toStrictEqual(Buffer.from(manifest));
        await writeFile(join(root, projectPath), rootPackage);
        const applied = await spawnGspot(root, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const repaired = JSON.parse(applied.stdout) as ApplyReport;
        expect(repaired.written).not.toContain(`.gspot/${selectLockfileName(packageManager)}`);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout)).toMatchObject({ installed: true });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).not.toContain('<<<<<<<');
    },
);

/** A clean clone installs its committed lockfile twice without changing tracked files. */
async function assertCloneInstallation(project: PackageManagerSandbox, inputs: ToolProjectFiles): Promise<void> {
    const { root, artifacts } = project;
    const { manifest, lockfile } = inputs;
    const clone = join(artifacts, 'clone');
    // Preserve native package-manager line endings through Git before testing installation byte preservation.
    await appendFile(join(root, '.gitattributes'), TOOL_PROJECT_BYTE_ATTRIBUTES);
    commitAll(root);
    readGitOutput(root, ['clone', '--quiet', '--no-local', root, clone]);
    expect(await isOnDisk(join(clone, '.gspot/node_modules'))).toBe(false);
    expect(await isOnDisk(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        const cloneInstall = await spawnGspot(clone, ['install']);
        expect(cloneInstall.code, cloneInstall.stdout + cloneInstall.stderr).toBe(0);
        expect(cloneInstall.stdout).toContain('.gspot/node_modules');
        const status = runGit(clone, ['status', '--porcelain']);
        expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
        expect(await readFile(join(clone, '.gspot', basename(inputs.lockfilePath)))).toStrictEqual(
            Buffer.from(lockfile),
        );
        expect(await readFile(join(clone, '.gspot/package.json'))).toStrictEqual(Buffer.from(manifest));
    }
    const diagnosed = await spawnGspot(clone, ['doctor', '--json']);
    expect((JSON.parse(diagnosed.stdout) as DoctorReport).tools.find((tool) => tool.name === 'prettier')?.state).toBe(
        'ok',
    );
}

test.each([...PACKAGE_MANAGER_ROWS])(
    '%s from %s preserves authored and locked inputs and restores edited tool files',
    async (packageManager, projectPath) => {
        await using sandbox = await createPackageManagerSandbox(packageManager, projectPath);
        const { root, rootPackage, yarnConfiguration } = sandbox;
        const { inputs } = await writeLockedInputs(root);
        const { manifest, lockfilePath, lockfile, mode } = inputs!;
        const installed = await spawnGspot(root, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(installed.stdout).toContain('.gspot/node_modules');
        const workspace = join(root, 'pnpm-workspace.yaml');
        const yarnrc = join(root, '.yarnrc.yml');
        const attributes = await stat(lockfilePath);
        expect({
            authored: await readFile(join(root, projectPath), 'utf8'),
            workspace: (await isOnDisk(workspace)) ? await readFile(workspace, 'utf8') : undefined,
            yarnrc: (await isOnDisk(yarnrc)) ? await readFile(yarnrc, 'utf8') : undefined,
            dependencies: await readFile(join(root, 'node_modules/authored.txt'), 'utf8'),
            lockfile: await readFile(lockfilePath),
            mode: attributes.mode,
            manifest: await readFile(join(root, '.gspot/package.json')),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? 'packages:\n  - "**"\n' : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lockfile: Buffer.from(lockfile),
            mode,
            manifest: Buffer.from(manifest),
        });
        // A reinstall replaces an edited installed file with the locked one, and the tool stays ready.
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = await readFile(readmePath);
        // Replace the file so native package-manager hardlinks do not edit its shared cache.
        await unlink(readmePath);
        await writeFile(readmePath, 'authored later');
        const reinstalled = await spawnGspot(root, ['install']);
        expect(reinstalled.code, reinstalled.stdout + reinstalled.stderr).toBe(0);
        expect(await readFile(readmePath)).toStrictEqual(readme);
        const readyTools = ['prettier', 'editorconfig-checker'];
        const diagnosed = await spawnGspot(root, ['doctor', '--json']);
        const report = JSON.parse(diagnosed.stdout) as DoctorReport;
        expect(readyTools.map((name) => report.tools.find((tool) => tool.name === name)?.state)).toStrictEqual(
            readyTools.map(() => 'ok'),
        );
        const preview = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(preview.stdout) as DryRunJson).stale).toStrictEqual([]);
        const applied = await spawnGspot(root, ['apply', '--json']);
        const second = JSON.parse(applied.stdout) as ApplyReport;
        expect(second.written).toStrictEqual([]);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        if (projectPath === 'package.json') await assertCloneInstallation(sandbox, inputs!);
    },
);

// Own the authenticated registry's requests and lifetime for its real package manager.
function createAuthenticatedRegistry(token: string) {
    const requests = { rejected: 0, authenticated: 0 };
    const server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(request) {
            if (request.headers.get('authorization') !== `Bearer ${token}`) {
                requests.rejected++;
                return Response.json({ error: 'Authentication required' }, { status: 401 });
            }
            requests.authenticated++;
            return Response.json({
                name: 'private-check-tool',
                'dist-tags': { latest: '1.0.0' },
                versions: { '1.0.0': { name: 'private-check-tool', version: '1.0.0' } },
            });
        },
    });
    return {
        url: `http://127.0.0.1:${String(server.port)}/`,
        requests,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

test('registry settings from the repository .npmrc authenticate an isolated project and leave the .npmrc unchanged', async () => {
    await using repository = await testdir();
    await using isolated = await testdir();
    const token = 'synthetic-registry-credential';
    await using registry = createAuthenticatedRegistry(token);
    const requests = registry.requests;
    const url = registry.url;
    await createFileTree(repository.path, {
        'package.json': '{"private":true}\n',
        '.npmrc': `registry=${url}\n`,
    });
    await createFileTree(isolated.path, { 'package.json': '{"private":true}\n' });
    const command = ['npm', 'view', 'private-check-tool', 'version', '--json', '--cache', join(isolated.path, 'cache')];
    const missing = await runTool(command, {
        timeoutSeconds: SETTING_DEFAULTS.tool_timeout_seconds,
        cwd: isolated.path,
        env: await readRegistryEnvironment(repository.path),
    });
    expect(missing.code).not.toBe(0);
    expect(requests.rejected).toBeGreaterThan(0);
    const source = `registry=${url}\n//${new URL(url).host}/:_authToken=${token}\n`;
    await writeFile(join(repository.path, '.npmrc'), source, { mode: 0o600 });
    const { mode } = await stat(join(repository.path, '.npmrc'));
    const corrected = await runTool(command, {
        timeoutSeconds: SETTING_DEFAULTS.tool_timeout_seconds,
        cwd: isolated.path,
        env: await readRegistryEnvironment(repository.path),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
    expect(requests.authenticated).toBeGreaterThan(0);
    expect(corrected.stdout + corrected.stderr).not.toContain(token);
    expect(await readFile(join(repository.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await stat(join(repository.path, '.npmrc'))).toMatchObject({ mode });
});
