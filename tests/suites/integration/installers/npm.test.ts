import { existsSync } from 'node:fs';
import { appendFile, chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'bun:test';
import prettierPackage from 'prettier/package.json' with { type: 'json' };
import { createFileTree, testdir } from 'testdirs';

import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { GSPOT_FOLDER } from '#cli/config/system.ts';
import { rootSettingSchemas } from '#cli/schemas/settings/file.ts';
import { selectLockfileName } from '#cli/tools/installers/npm/lockfiles.ts';
import { readRegistryEnvironment } from '#cli/tools/installers/npm/registry.ts';
import { runTool } from '#cli/tools/run.ts';
import type { ToolPackageManager } from '#cli/types/tools.ts';
import {
    NPM_PROJECT_FILES,
    NPM_PROJECT_IGNORES,
    NPM_PROJECT_ROOT_PACKAGE,
    NPM_REGISTRY_TOKEN,
} from '#tests/config/integration/general.ts';
import { AUTHENTICATION_REQUIRED_MESSAGE, REGISTRY_HOST } from '#tests/config/setup/runner.ts';
import { PNPM_WORKSPACE } from '#tests/config/setup/sandboxes.ts';
import { doctorOutputSchema, installOutputSchema } from '#tests/schemas/setup.ts';
import { parseCheckReport, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readToolProjectFiles } from '#tests/setup/cli/tools.ts';
import { startNpmRegistry } from '#tests/setup/runner/npm-registry.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand, runCommand } from '#tests/setup/system/processes.ts';
import type { NpmProject } from '#tests/types/integration.ts';
import type { NpmRegistry, ToolProjectFiles } from '#tests/types/setup.ts';

const PACKAGE_MANAGERS = ['npm', 'bun', 'pnpm'] as const;

async function writeNpmProject(options: {
    root: string;
    artifacts: string;
    registry: NpmRegistry;
    packageManager: ToolPackageManager['name'];
}): Promise<string> {
    const { root, artifacts, registry, packageManager } = options;
    const version = await runCommand([packageManager, '--version'], { cwd: artifacts });
    if (version.code !== 0) throw new Error(`Package manager version failed: ${version.stdout}${version.stderr}`);
    const rootPackage = JSON.stringify({
        ...NPM_PROJECT_ROOT_PACKAGE,
        packageManager: `${packageManager}@${version.stdout.trim()}`,
    });
    await createFileTree(root, {
        'package.json': rootPackage,
        'pnpm-workspace.yaml': PNPM_WORKSPACE,
        '.npmrc': `registry=${registry.url}/\nalways-auth=true\n${registry.url.replace('http:', '')}/:_authToken=${NPM_REGISTRY_TOKEN}\n`,
        'gspot.toml': buildSandboxSettings(['format'], {
            ignore: {
                checks: NPM_PROJECT_IGNORES,
                reason: 'The sandbox tests package-manager installation and preserves authored dependencies.',
            },
            level: 'basic',
        }),
        ...NPM_PROJECT_FILES,
    });
    runGitStep(root, ['init', '--quiet']);
    return rootPackage;
}

async function createNpmProject(packageManager: ToolPackageManager['name']): Promise<NpmProject> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    const root = join(folder.path, 'repository');
    const artifacts = join(folder.path, 'artifacts');
    await mkdir(artifacts);
    const installPlan = {
        packages: [
            {
                name: prettierPackage.name,
                source: dirname(fileURLToPath(import.meta.resolve('prettier/package.json'))),
                version: prettierPackage.version,
                bin: { [prettierPackage.name]: prettierPackage.bin },
            },
        ],

        token: NPM_REGISTRY_TOKEN,
    };
    const registry = resources.use(await startNpmRegistry(artifacts, installPlan));
    const rootPackage = await writeNpmProject({ root, artifacts, registry, packageManager });
    await applyGeneratedFiles(root);
    const owned = resources.move();
    return {
        root,
        artifacts,
        registry,
        rootPackage,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

async function assertFreshClone(
    { root, artifacts }: Pick<NpmProject, 'root' | 'artifacts'>,
    { projectFile, lockfile, lockfilePath }: ToolProjectFiles,
): Promise<void> {
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
        doctorOutputSchema.parse(JSON.parse(diagnosed.stdout)).tools.find((tool) => tool.name === 'prettier')?.state,
    ).toBe('ok');
}

test.concurrent('a write of the generated files keeps a stale npm lockfile and install repairs it', async () => {
    await using sandbox = await createNpmProject('npm');
    const { root } = sandbox;
    await runGspotStep({ root, run: spawnGspot }, ['install']);
    const { lockfilePath, lockfile } = await readToolProjectFiles(root, 'npm');
    for (let round = 0; round < 2; round++) {
        await applyGeneratedFiles(root);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
    }
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
        file: `${GSPOT_FOLDER}/${selectLockfileName('npm')}`,
        rule: 'changed',
    });
    const installed = await spawnGspot(root, ['install', '--json']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
    const repaired = await spawnGspot(root, ['check', '--only', 'gspot/generated-files', '--json']);
    expect(parseCheckReport(repaired).report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test.concurrent.each([...PACKAGE_MANAGERS])(
    '%s keeps the authored package files and the lockfile, a reinstall follows the tool manager, and a fresh clone installs the committed lockfile twice',
    async (packageManager) => {
        await using sandbox = await createNpmProject(packageManager);
        const { root, rootPackage, registry } = sandbox;
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        const version = await runCommand([packageManager, '--version'], { cwd: root });
        expect(installOutputSchema.parse(JSON.parse(installed.stdout)).installed).toContain(
            `installed 1 npm tool in ${GSPOT_PATHS.nodeModules} (${packageManager} ${version.stdout.trim()})`,
        );
        const toolProject = await readToolProjectFiles(root, packageManager);
        const { lockfilePath, lockfile } = toolProject;
        const lockfileText = Buffer.from(lockfile).toString('utf8');
        expect(lockfileText).not.toContain(registry.url);
        const repeated = await spawnGspot(root, ['install', '--json']);
        expect(
            { code: repeated.code, installed: installOutputSchema.parse(JSON.parse(repeated.stdout)).installed },
            repeated.stdout + repeated.stderr,
        ).toStrictEqual({ code: 0, installed: [] });
        expect({
            authored: await readFile(join(root, 'package.json'), 'utf8'),
            workspace: await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'),
            dependencies: await readFile(join(root, 'node_modules/authored.txt'), 'utf8'),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: PNPM_WORKSPACE,
            dependencies: 'keep project dependencies',
        });
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
        await assertFreshClone(sandbox, toolProject);
    },
);

test('a repeated npm install keeps the lockfile and the modules with the registry offline', async () => {
    await using sandbox = await createNpmProject('npm');
    const { root, registry } = sandbox;
    const first = await spawnGspot(root, ['install']);
    expect(first.code, first.stdout + first.stderr).toBe(0);
    const lockfile = await readFile(join(root, GSPOT_FOLDER, 'package-lock.json'), 'utf8');
    const marker = join(root, GSPOT_PATHS.nodeModules, 'prettier/keep.txt');
    await writeFile(marker, 'installed modules');
    const requests = registry.requests.filter((request) => request !== 'GET /npm');
    for (const isOnline of [true, false]) {
        if (!isOnline) registry[Symbol.dispose]();
        const next = await spawnGspot(root, ['install', '--json']);
        expect(next.code, next.stdout + next.stderr).toBe(0);
        expect(JSON.parse(next.stdout)).toMatchObject({ installed: [], written: [], deleted: [], updated: [] });
        expect(await readFile(join(root, GSPOT_FOLDER, 'package-lock.json'), 'utf8')).toBe(lockfile);
        expect(
            registry.requests.filter((request) => request !== 'GET /npm'),
            next.stdout,
        ).toStrictEqual(requests);
        expect(await readFile(marker, 'utf8')).toBe('installed modules');
    }
});

test('registry settings from the repository .npmrc authenticate an isolated project', async () => {
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
    const corrected = await runTool(command, {
        timeoutSeconds: rootSettingSchemas.tool_timeout_seconds.parse(undefined),
        cwd: isolated.path,
        env: await readRegistryEnvironment(sandbox.path),
    });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(JSON.parse(corrected.stdout)).toBe('1.0.0');
    expect(requests).toStrictEqual({ rejected, authenticated: 1 });
});
