import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import type { ToolPin } from '#cli/types/parsers/tool.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { installTools } from '#cli/lifecycle/install/public.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { stat, readdir, readFile, writeFile } from 'node:fs/promises';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { inspectTool, prepareToolProjects } from '#cli/tools/public.ts';
import { computeDrift, writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';
import type { PackageInputs, PackageProject } from '#tests/types/harness/npm.ts';

// Keep the locked inputs ahead of both the initial native installation and its clone journey.
async function prepareInputs(root: string, log: Log) {
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeGeneratedFiles(session, generated, log);
    return { session, inputs: await readPackageInputs(root, session.packageInstaller()!.name) };
}

/** A clean clone installs its committed lockfile twice without changing tracked files. */
async function expectCloneInstallation(
    project: PackageProject,
    inputs: PackageInputs,
    tools: ToolPin[],
): Promise<void> {
    const { root, artifacts } = project;
    const { manifest, lockfile } = inputs;
    const clone = join(artifacts, 'clone');
    commitAll(root);
    gitOutput(root, ['clone', '--quiet', '--no-local', root, clone]);
    expect(await pathExists(join(clone, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        using cloneLog = openOwnership(clone);
        const { session } = await prepareInputs(clone, cloneLog);
        const cloneInstall = await installTools(session, cloneLog, emitAll(session), { refreshLockfiles: false });
        expect(cloneInstall.exitCode, cloneInstall.note).toBe(0);
        expect(cloneInstall.note).toContain('.gspot/node_modules');
        const status = await runTestCommand(['git', 'status', '--porcelain'], { cwd: clone });
        expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
        // Git for Windows may change checkout line endings while preserving the committed lockfile.
        const clonedLockfile = await readFile(join(clone, '.gspot', basename(inputs.lockfilePath)), 'utf8');
        expect(clonedLockfile.replaceAll('\r\n', '\n')).toBe(lockfile.toString('utf8').replaceAll('\r\n', '\n'));
        expect(await readFile(join(clone, '.gspot/package.json'))).toStrictEqual(manifest);
    }
    const prettier = tools.find((tool) => tool.name === 'prettier')!;
    expect(inspectTool({ root: clone, inspections: new Map() }, prettier).state).toBe('ok');
}

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s preserves authored and locked inputs and restores edited tool files',
    async (installer, projectPath, runner) => {
        await using sandbox = await createPackageProject(installer, projectPath, runner);
        const { root, artifacts, rootPackage, yarnConfiguration, tools } = sandbox;
        using log = openOwnership(root);
        const { session, inputs } = await prepareInputs(root, log);
        const { manifest, lockfilePath, lockfile, mode } = inputs;
        setEnvironmentVariable('YARN_CACHE_FOLDER', join(artifacts, 'installation-cache'));
        setEnvironmentVariable('YARN_GLOBAL_FOLDER', join(artifacts, 'installation-global'));
        const installed = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
        expect(installed.exitCode, installed.note).toBe(0);
        expect(installed.note).toContain('.gspot/node_modules');
        const workspace = join(root, 'pnpm-workspace.yaml');
        const yarnrc = join(root, '.yarnrc.yml');
        const attributes = await stat(lockfilePath);
        expect({
            authored: await readFile(join(root, projectPath), 'utf8'),
            workspace: (await pathExists(workspace)) ? await readFile(workspace, 'utf8') : undefined,
            yarnrc: (await pathExists(yarnrc)) ? await readFile(yarnrc, 'utf8') : undefined,
            dependencies: await readFile(join(root, 'node_modules/authored.txt'), 'utf8'),
            lockfile: await readFile(lockfilePath),
            mode: attributes.mode,
            manifest: await readFile(join(root, '.gspot/package.json')),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? 'packages:\n  - "**"\n' : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lockfile,
            mode,
            manifest,
        });
        // A reinstall replaces an edited installed file with the locked one, and the tool stays ready.
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = await readFile(readmePath);
        await writeFile(readmePath, 'authored later');
        const reinstalled = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
        expect(reinstalled.exitCode, reinstalled.note).toBe(0);
        expect(await readFile(readmePath)).toStrictEqual(readme);
        const readyTools = runner === 'none' ? ['prettier', 'ec'] : ['prettier'];
        expect(
            readyTools.map(
                (name) =>
                    inspectTool({ root, inspections: new Map() }, tools.find((tool) => tool.name === name)!).state,
            ),
        ).toStrictEqual(readyTools.map(() => 'ok'));
        if (runner === 'none') {
            const binaries = await readdir(join(root, '.gspot/node_modules/editorconfig-checker/bin'), {
                encoding: 'utf8',
                recursive: true,
            });
            expect(binaries.some((path) => /(?:^|[/\\])editorconfig-checker(?:\.exe)?$/u.test(path))).toBe(true);
        }
        expect(computeDrift(root, emitAll(session))).toStrictEqual([]);
        const second = await openSession(root).then((refreshed) =>
            writeGeneratedFiles(refreshed, emitAll(refreshed), log),
        );
        expect(second.written).toStrictEqual([]);
        expect(await readFile(lockfilePath)).toStrictEqual(lockfile);
        if (projectPath === 'package.json' && runner === 'mise') await expectCloneInstallation(sandbox, inputs, tools);
    },
);
