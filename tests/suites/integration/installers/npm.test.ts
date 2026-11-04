import { existsSync } from 'node:fs';
import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { GSPOT_FOLDER } from '#cli/config/parsers.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createNpmProject } from '#tests/setup/sandboxes/projects/npm.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { runCommand, runBlockingCommand } from '#tests/setup/system/processes.ts';
import { doctorOutputSchema, installOutputSchema } from '#cli/schemas/commands.ts';
import { stat, chmod, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';
import { spawnGspot, runGspotStep, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { PACKAGE_MANAGER_CASES, PACKAGE_MANAGER_AGE_REFUSALS } from '#tests/config/integration/commands.ts';

import {
    REGISTRY_HOST,
    PNPM_WORKSPACE,
    NPM_REGISTRY_TOKEN,
    AUTHENTICATION_REQUIRED_MESSAGE,
} from '#tests/config/setup/sandboxes.ts';

test.concurrent.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s: a write of the generated files keeps a stale lockfile and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, registry, toolPackageManager } = sandbox;
        await runGspotStep({ root, run: spawnGspot }, ['install']);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, toolPackageManager);
        expect(Buffer.from(lockfile).toString('utf8')).not.toContain(NPM_REGISTRY_TOKEN);
        for (let round = 0; round < 2; round++) {
            await applyGeneratedFiles(root);
            expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        }
        if (packageManager === 'yarn') expect(Buffer.from(lockfile).toString('utf8')).not.toContain(registry.url);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierPackage.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        await writeFile(lockfilePath, stale);
        await applyGeneratedFiles(root);
        expect(await readFile(lockfilePath, 'utf8')).toBe(stale);
        const preview = await spawnGspot(root, ['check', '--only', 'gspot/generated-files', '--json']);
        expect(
            parseCheckReport(preview)
                .report.checks.flatMap(({ findings }) => findings)
                .map(({ file, rule }) => ({ file, rule })),
        ).toContainEqual({
            file: `${GSPOT_FOLDER}/${selectLockfileName(toolPackageManager)}`,
            rule: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        const repaired = await spawnGspot(root, ['check', '--only', 'gspot/generated-files', '--json']);
        expect(parseCheckReport(repaired).report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    },
);

test.concurrent.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    '%s from %s keeps a conflicted lockfile through a write until the packageManager pin is fixed, and install repairs it',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage, toolPackageManager } = sandbox;
        await runGspotStep({ root, run: spawnGspot }, ['install']);
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
        await applyGeneratedFiles(root);
        const appliedPackageJson = await readFile(join(root, GSPOT_PATHS.npmProject));
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, GSPOT_PATHS.npmProject))).toStrictEqual(appliedPackageJson);
        await writeFile(join(root, projectPath), rootPackage);
        const repaired = await applyGeneratedFiles(root);
        expect(repaired.written).not.toContain(`${GSPOT_FOLDER}/${selectLockfileName(toolPackageManager)}`);
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
    },
);

test.concurrent.each([...PACKAGE_MANAGER_CASES])(
    '%s from %s keeps the authored package files and the lockfile, and a reinstall follows the tool manager',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, rootPackage, yarnConfiguration, toolPackageManager } = sandbox;
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const version = await runCommand([toolPackageManager, '--version'], { cwd: root });
        expect(installOutputSchema.parse(JSON.parse(installed.stdout)).installed).toContain(
            `installed 1 npm tool in ${GSPOT_PATHS.nodeModules} (${toolPackageManager} ${version.stdout.trim()})`,
        );
        const { projectFile, lockfilePath, lockfile, mode } = await readToolProjectFiles(root, toolPackageManager);
        const repeated = await spawnGspot(root, ['install', '--json']);
        expect(
            { code: repeated.code, installed: installOutputSchema.parse(JSON.parse(repeated.stdout)).installed },
            repeated.stdout + repeated.stderr,
        ).toStrictEqual({ code: 0, installed: [] });
        const workspace = join(root, 'pnpm-workspace.yaml');
        const yarnrc = join(root, '.yarnrc.yml');
        const attributes = await stat(lockfilePath);
        expect({
            authored: await readFile(join(root, projectPath), 'utf8'),
            workspace: existsSync(workspace) ? await readFile(workspace, 'utf8') : undefined,
            yarnrc: existsSync(yarnrc) ? await readFile(yarnrc, 'utf8') : undefined,
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
        await unlink(readmePath);
        await writeFile(readmePath, 'authored later');
        const reinstalled = await spawnGspot(root, ['install']);
        expect(reinstalled.code, reinstalled.stdout + reinstalled.stderr).toBe(0);
        expect(await readFile(readmePath, 'utf8')).toBe('authored later');
        const readyTools = ['prettier', 'editorconfig-checker'];
        const diagnosed = await spawnGspot(root, ['doctor', '--json']);
        const report = doctorOutputSchema.parse(JSON.parse(diagnosed.stdout));
        expect(readyTools.map((name) => report.tools.find((tool) => tool.name === name)?.state)).toStrictEqual(
            readyTools.map(() => 'ok'),
        );
        const preview = await spawnGspot(root, ['check', '--only', 'gspot/generated-files', '--json']);
        expect(
            parseCheckReport(preview)
                .report.checks.flatMap(({ findings }) => findings)
                .map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([]);
        const second = await applyGeneratedFiles(root);
        expect(second.written).toStrictEqual([]);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
    },
);

test.concurrent.each(PACKAGE_MANAGER_CASES.filter(([, path]) => path === 'package.json'))(
    'a fresh clone of a %s project from %s installs the committed lockfile twice and leaves tracked files unchanged',
    async (packageManager, projectPath) => {
        await using sandbox = await createNpmProject(packageManager, projectPath);
        const { root, artifacts, toolPackageManager } = sandbox;
        await runGspotStep({ root, run: spawnGspot }, ['install']);
        const { projectFile, lockfile, lockfilePath } = await readToolProjectFiles(root, toolPackageManager);
        const clone = join(artifacts, 'clone');
        await appendFile(join(root, '.gitattributes'), '\n.gspot/* -text\n');
        commitAll(root);
        runGitStep(root, ['clone', '--quiet', '--no-local', root, clone]);
        expect(existsSync(join(clone, GSPOT_PATHS.nodeModules))).toBe(false);
        for (let round = 0; round < 2; round++) {
            const cloneInstall = await spawnGspot(clone, ['install']);
            expect(cloneInstall.code, cloneInstall.stdout + cloneInstall.stderr).toBe(0);
            const status = runBlockingCommand(['git', 'status', '--porcelain'], { cwd: clone, env: {} });
            expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
            const contents = await readFile(join(clone, GSPOT_FOLDER, basename(lockfilePath)));
            expect(contents).toStrictEqual(Buffer.from(lockfile));
            expect(await readFile(join(clone, GSPOT_PATHS.npmProject))).toStrictEqual(Buffer.from(projectFile));
        }
        const diagnosed = await spawnGspot(clone, ['doctor', '--json']);
        expect(
            doctorOutputSchema.parse(JSON.parse(diagnosed.stdout)).tools.find((tool) => tool.name === 'prettier')
                ?.state,
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
                return Response.json({ error: AUTHENTICATION_REQUIRED_MESSAGE }, { status: 401 });
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
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
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
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
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
