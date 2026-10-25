import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import type { ApplyReport } from '#cli/types/apply.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { DryRunJson } from '#cli/types/commands/apply.ts';
import type { CommandFailureJson } from '#cli/types/terminal.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import type { DoctorReport } from '#cli/types/commands/doctor.ts';
import { DOT_GSPOT, GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { selectLockfileName } from '#cli/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/installers/npm/registry.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { spawnGspot, applyThenInstall } from '#tests/setup/cli/commands.ts';
import { PACKAGE_MANAGER_CASES } from '#tests/config/integration/samples.ts';
import { SETTING_DEFINITIONS } from '#cli/config/settings/definitions/all-settings.ts';
import { stat, chmod, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';
import { PACKAGE_MANAGER_AGE_REFUSALS } from '#tests/config/integration/installers/npm.ts';
import { runGit, commitAll, runGitStep, createGitSandbox } from '#tests/setup/system/git.ts';
import { REGISTRY_HOST, PNPM_WORKSPACE, NPM_REGISTRY_TOKEN } from '#tests/config/setup/sandboxes.ts';

test.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s: apply keeps a stale lockfile and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, registry, toolPackageManager } = sandbox;
        await applyThenInstall(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, toolPackageManager);
        expect(Buffer.from(lockfile).toString('utf8')).not.toContain(NPM_REGISTRY_TOKEN);
        for (let round = 0; round < 2; round++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        }
        if (packageManager === 'yarn') expect(Buffer.from(lockfile).toString('utf8')).not.toContain(registry.url);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierPackage.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        await writeFile(lockfilePath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(await readFile(lockfilePath, 'utf8')).toBe(stale);
        const preview = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(preview.stdout) as DryRunJson).outdated).toContainEqual({
            path: `${DOT_GSPOT}/${selectLockfileName(toolPackageManager)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        const repaired = await spawnGspot(root, ['apply', '--dry-run', '--json']);
        expect((JSON.parse(repaired.stdout) as DryRunJson).outdated).toStrictEqual([]);
    },
);

test.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s keeps a conflicted lockfile through apply until the packageManager pin is fixed, and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage, toolPackageManager } = sandbox;
        await applyThenInstall(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, toolPackageManager);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierPackage.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${Buffer.from(lockfile).toString('utf8')}\n>>>>>>> generated\n`;
        await writeFile(lockfilePath, conflict);
        await writeFile(
            join(root, projectPath),
            JSON.stringify({
                ...JSON.parse(rootPackage),
                packageManager: `${toolPackageManager}@${PACKAGE_MANAGER_AGE_REFUSALS[toolPackageManager].version}`,
            }),
        );
        const reapplied = await spawnGspot(root, ['apply', '--json']);
        expect(reapplied.code, reapplied.stdout + reapplied.stderr).toBe(0);
        const appliedPackageJson = await readFile(join(root, GSPOT_PATHS.npmProject));
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        const { message } = JSON.parse(refused.stdout) as CommandFailureJson;
        const refusal = PACKAGE_MANAGER_AGE_REFUSALS[toolPackageManager];
        expect(message).toBe(
            `gspot install needs ${toolPackageManager} ${refusal.minimum} or later, which holds back new releases for dependencies.min_release_age_days. Found ${refusal.version}.`,
        );
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, GSPOT_PATHS.npmProject))).toStrictEqual(appliedPackageJson);
        await writeFile(join(root, projectPath), rootPackage);
        const applied = await spawnGspot(root, ['apply', '--json']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const repaired = JSON.parse(applied.stdout) as ApplyReport;
        expect(repaired.written).not.toContain(`${DOT_GSPOT}/${selectLockfileName(toolPackageManager)}`);
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
    },
);

test.each([...PACKAGE_MANAGER_CASES])(
    '%s from %s keeps the authored package files and the lockfile, and a reinstall restores an edited config file',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage, yarnConfiguration, toolPackageManager } = sandbox;
        await applyThenInstall(root);
        const { projectFile, lockfilePath, lockfile, mode } = await readToolProjectFiles(root, toolPackageManager);
        const installed = await spawnGspot(root, ['install']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const version = await runCommand([toolPackageManager, '--version'], { cwd: root });
        expect(installed.stdout.split('\n', 1)[0]).toBe(
            `installed 1 npm tool in ${GSPOT_PATHS.nodeModules} (${toolPackageManager} ${version.stdout.trim()})`,
        );
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
            projectFile: await readFile(join(root, GSPOT_PATHS.npmProject)),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? PNPM_WORKSPACE : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lockfile: Buffer.from(lockfile),
            mode,
            projectFile: Buffer.from(projectFile),
        });
        const readmePath = join(root, `${GSPOT_PATHS.nodeModules}/prettier/README.md`);
        const readme = await readFile(readmePath);
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
        expect((JSON.parse(preview.stdout) as DryRunJson).outdated).toStrictEqual([]);
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
        const { root, artifacts, toolPackageManager } = sandbox;
        await applyThenInstall(root);
        const { projectFile, lockfile, lockfilePath } = await readToolProjectFiles(root, toolPackageManager);
        const clone = join(artifacts, 'clone');
        await appendFile(join(root, '.gitattributes'), '\n.gspot/* -text\n');
        commitAll(root);
        runGitStep(root, ['clone', '--quiet', '--no-local', root, clone]);
        expect(await isOnDisk(join(clone, GSPOT_PATHS.nodeModules))).toBe(false);
        for (let round = 0; round < 2; round++) {
            const cloneInstall = await spawnGspot(clone, ['install']);
            expect(cloneInstall.code, cloneInstall.stdout + cloneInstall.stderr).toBe(0);
            const version = await runCommand([toolPackageManager, '--version'], { cwd: clone });
            expect(cloneInstall.stdout.split('\n', 1)[0]).toBe(
                `installed 1 npm tool in ${GSPOT_PATHS.nodeModules} (${toolPackageManager} ${version.stdout.trim()})`,
            );
            const status = runGit(clone, ['status', '--porcelain']);
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            const contents = await readFile(join(clone, DOT_GSPOT, basename(lockfilePath)));
            expect(contents).toStrictEqual(Buffer.from(lockfile));
            expect(await readFile(join(clone, GSPOT_PATHS.npmProject))).toStrictEqual(Buffer.from(projectFile));
        }
        const diagnosed = await spawnGspot(clone, ['doctor', '--json']);
        expect(
            (JSON.parse(diagnosed.stdout) as DoctorReport).tools.find((tool) => tool.name === 'prettier')?.state,
        ).toBe('ok');
    },
);

test('registry settings from the repository .npmrc authenticate an isolated project and leave the .npmrc unchanged', async () => {
    const token = 'synthetic-registry-credential';
    const requests = { rejected: 0, authenticated: 0 };
    using server = Bun.serve({
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
    const url = `http://${REGISTRY_HOST}:${String(server.port)}/`;
    await using sandbox = await createGitSandbox({
        'package.json': '{"private":true}\n',
        '.npmrc': `registry=${url}\n`,
    });
    await using isolated = await createGitSandbox({ 'package.json': '{"private":true}\n' });
    const command = ['npm', 'view', 'private-check-tool', 'version', '--json', '--cache', join(isolated.path, 'cache')];
    const missing = await runTool(command, {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        cwd: isolated.path,
        env: await readRegistryEnvironment(sandbox.path),
    });
    expect(missing.code, missing.stdout + missing.stderr).toBe(1);
    expect(requests.authenticated).toBe(0);
    const { rejected } = requests;
    expect(rejected).toBeGreaterThan(0);
    const source = `registry=${url}\n//${new URL(url).host}/:_authToken=${token}\n`;
    await writeFile(join(sandbox.path, '.npmrc'), source, { mode: 0o600 });
    const { mode } = await stat(join(sandbox.path, '.npmrc'));
    const corrected = await runTool(command, {
        timeoutSeconds: SETTING_DEFINITIONS['tool_timeout_seconds'].default,
        cwd: isolated.path,
        env: await readRegistryEnvironment(sandbox.path),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
    expect(requests).toStrictEqual({ rejected, authenticated: 1 });
    expect(corrected.stdout + corrected.stderr).not.toContain(token);
    expect(await readFile(join(sandbox.path, '.npmrc'), 'utf8')).toBe(source);
    expect(await stat(join(sandbox.path, '.npmrc'))).toMatchObject({ mode });
});
