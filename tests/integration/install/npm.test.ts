import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { testdir, createFileTree } from 'testdirs';
import type { ApplyReport } from '#cli/types/apply.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { SETTING_FACTS } from '#cli/config/settings/facts.ts';
import type { DryRunJson } from '#cli/types/commands/apply.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { selectLockfileName } from '#cli/install/npm/tool-project.ts';
import { readRegistryEnvironment } from '#cli/install/npm/registry.ts';
import { createNpmProject } from '#tests/setup/sandboxes/npm/project.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { runGit, commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { PACKAGE_MANAGER_CASES } from '#tests/data/install/npm/tool-project.ts';
import { spawnGspot, installGeneratedTools } from '#tests/setup/cli/commands.ts';
import { TOOL_PROJECT_BYTE_ATTRIBUTES } from '#tests/data/integration/install/npm.ts';
import { stat, chmod, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';
import { REGISTRY_HOST, PNPM_WORKSPACE, NPM_REGISTRY_TOKEN } from '#tests/data/setup/sandboxes.ts';

/** Serve an authenticated registry for a real package manager and count its requests. */
function createAuthenticatedRegistry(token: string) {
    const requests = { rejected: 0, authenticated: 0 };
    const server = Bun.serve({
        hostname: REGISTRY_HOST,
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
        url: `http://${REGISTRY_HOST}:${String(server.port)}/`,
        requests,
        async [Symbol.asyncDispose]() {
            await server.stop(true);
        },
    };
}

test.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s: apply keeps a stale lockfile and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, registry } = sandbox;
        await installGeneratedTools(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, packageManager);
        expect(Buffer.from(lockfile).toString('utf8')).not.toContain(NPM_REGISTRY_TOKEN);
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        }
        // Yarn 1 writes resolved package addresses into its lockfile; these must exclude the private registry.
        if (packageManager === 'yarn') expect(Buffer.from(lockfile).toString('utf8')).not.toContain(registry.url);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierPackage.version, '0.0.0');
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
        const steps: unknown = expect.arrayContaining([[packageManager, '--version']]);
        expect(JSON.parse(installed.stdout)).toStrictEqual({ steps });
        expect(await readFile(lockfilePath, 'utf8')).not.toBe(stale);
        const repaired = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(repaired.stdout) as DryRunJson).stale).not.toContainEqual({
            path: `.gspot/${selectLockfileName(packageManager)}`,
            kind: 'changed',
        });
    },
);

test.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s keeps a conflicted lockfile through apply until the packageManager pin is fixed, and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage } = sandbox;
        await installGeneratedTools(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, packageManager);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierPackage.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${Buffer.from(lockfile).toString('utf8')}\n>>>>>>> generated\n`;
        await writeFile(lockfilePath, conflict);
        await writeFile(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${packageManager}@99.0.0` }),
        );
        const pinned = await spawnGspot(root, ['apply', '--json']);
        expect(pinned.code, pinned.stdout + pinned.stderr).toBe(0);
        const pinnedPackageJson = await readFile(join(root, '.gspot/package.json'));
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, '.gspot/package.json'))).toStrictEqual(pinnedPackageJson);
        await writeFile(join(root, projectPath), rootPackage);
        const applied = await spawnGspot(root, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const repaired = JSON.parse(applied.stdout) as ApplyReport;
        expect(repaired.written).not.toContain(`.gspot/${selectLockfileName(packageManager)}`);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const steps: unknown = expect.arrayContaining([[packageManager, '--version']]);
        expect(JSON.parse(installed.stdout)).toStrictEqual({ steps });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).not.toContain('<<<<<<<');
    },
);

test.each([...PACKAGE_MANAGER_CASES])(
    '%s from %s keeps your package files and the lockfile, and a reinstall restores an edited config file',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage, yarnConfiguration } = sandbox;
        await installGeneratedTools(root);
        const { projectFile, lockfilePath, lockfile, mode } = await readToolProjectFiles(root, packageManager);
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
            projectFile: await readFile(join(root, '.gspot/package.json')),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? PNPM_WORKSPACE : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lockfile: Buffer.from(lockfile),
            mode,
            projectFile: Buffer.from(projectFile),
        });
        // A reinstall replaces an edited installed file with the locked one, and the tool stays ready.
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = await readFile(readmePath);
        // Replace the file so that the edit does not reach the shared cache through package manager hardlinks.
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
    },
);

test.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    'a fresh clone of a %s project from %s installs the committed lockfile twice and leaves tracked files unchanged',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, artifacts } = sandbox;
        await installGeneratedTools(root);
        const { projectFile, lockfile, lockfilePath } = await readToolProjectFiles(root, packageManager);
        const clone = join(artifacts, 'clone');
        // Keep the line endings of the package manager through Git, so the install test can compare bytes.
        await appendFile(join(root, '.gitattributes'), TOOL_PROJECT_BYTE_ATTRIBUTES);
        commitAll(root);
        runGitStep(root, ['clone', '--quiet', '--no-local', root, clone]);
        expect(await isOnDisk(join(clone, '.gspot/node_modules'))).toBe(false);
        for (let attempt = 0; attempt < 2; attempt++) {
            const cloneInstall = await spawnGspot(clone, ['install']);
            expect(cloneInstall.code, cloneInstall.stdout + cloneInstall.stderr).toBe(0);
            expect(cloneInstall.stdout).toContain('.gspot/node_modules');
            const status = runGit(clone, ['status', '--porcelain']);
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            expect(await readFile(join(clone, '.gspot', basename(lockfilePath)))).toStrictEqual(Buffer.from(lockfile));
            expect(await readFile(join(clone, '.gspot/package.json'))).toStrictEqual(Buffer.from(projectFile));
        }
        const diagnosed = await spawnGspot(clone, ['doctor', '--json']);
        expect(
            (JSON.parse(diagnosed.stdout) as DoctorReport).tools.find((tool) => tool.name === 'prettier')?.state,
        ).toBe('ok');
    },
);

test('registry settings from the repository .npmrc authenticate an isolated project and leave the .npmrc unchanged', async () => {
    await using sandbox = await testdir();
    await using isolated = await testdir();
    const token = 'synthetic-registry-credential';
    await using registry = createAuthenticatedRegistry(token);
    const requests = registry.requests;
    const url = registry.url;
    await createFileTree(sandbox.path, {
        'package.json': '{"private":true}\n',
        '.npmrc': `registry=${url}\n`,
    });
    await createFileTree(isolated.path, { 'package.json': '{"private":true}\n' });
    const command = ['npm', 'view', 'private-check-tool', 'version', '--json', '--cache', join(isolated.path, 'cache')];
    const missing = await runTool(command, {
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        cwd: isolated.path,
        env: await readRegistryEnvironment(sandbox.path),
    });
    expect(missing.code).not.toBe(0);
    expect(requests.rejected).toBeGreaterThan(0);
    const source = `registry=${url}\n//${new URL(url).host}/:_authToken=${token}\n`;
    await writeFile(join(sandbox.path, '.npmrc'), source, { mode: 0o600 });
    const { mode } = await stat(join(sandbox.path, '.npmrc'));
    const corrected = await runTool(command, {
        timeoutSeconds: SETTING_FACTS['tool_timeout_seconds'].default,
        cwd: isolated.path,
        env: await readRegistryEnvironment(sandbox.path),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
    expect(requests.authenticated).toBeGreaterThan(0);
    expect(corrected.stdout + corrected.stderr).not.toContain(token);
    expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await stat(join(sandbox.path, '.npmrc'))).toMatchObject({ mode });
});
