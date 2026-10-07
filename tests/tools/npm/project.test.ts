import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { inspectTool } from '#cli/tools/inspect.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { openSession } from '#cli/commands/session.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { prepareToolProjects } from '#cli/tools/project.ts';
import type { Log } from '#cli/types/lifecycle/ownership.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';
import type { PackageInputs, PackageProject } from '#tests/types/harness/npm.ts';
import { statSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

// Keep the locked inputs ahead of both the initial native installation and its clone journey.
async function prepareInputs(root: string, log: Log) {
    const session = await openSession(root);
    const generated = emitAll(session);
    await prepareToolProjects(session, generated.files, log.files, { refreshLockfiles: false });
    writeOutputs(session, log, undefined, generated);
    return { session, inputs: readPackageInputs(root, session.packageInstaller()!.name) };
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
    expect(existsSync(join(clone, '.gspot/node_modules'))).toBe(false);
    expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        using cloneLog = openOwnership(clone);
        const { session } = await prepareInputs(clone, cloneLog);
        const cloneInstall = await installTools(session, cloneLog, emitAll(session), { refreshLockfiles: false });
        expect(cloneInstall.exitCode, cloneInstall.note).toBe(0);
        expect(cloneInstall.note).toContain('.gspot/node_modules');
        const status = await runTestCommand(['git', 'status', '--porcelain'], { cwd: clone });
        expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
        // Git for Windows may change checkout line endings while preserving the committed lockfile.
        expect(
            readFileSync(join(clone, '.gspot', basename(inputs.lockfilePath)), 'utf8').replaceAll('\r\n', '\n'),
        ).toBe(lockfile.toString('utf8').replaceAll('\r\n', '\n'));
        expect(readFileSync(join(clone, '.gspot/package.json'))).toStrictEqual(manifest);
    }
    const prettier = tools.find((tool) => tool.name === 'prettier')!;
    expect(inspectTool({ root: clone, inspections: new Map() }, prettier).state).toBe('ok');
}

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s preserves authored and locked inputs and restores edited tool files',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, artifacts, rootPackage, yarnConfiguration, tools } = fixture;
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
        expect({
            authored: readFileSync(join(root, projectPath), 'utf8'),
            workspace: existsSync(workspace) ? readFileSync(workspace, 'utf8') : undefined,
            yarnrc: existsSync(yarnrc) ? readFileSync(yarnrc, 'utf8') : undefined,
            dependencies: readFileSync(join(root, 'node_modules/authored.txt'), 'utf8'),
            lockfile: readFileSync(lockfilePath),
            mode: statSync(lockfilePath).mode,
            manifest: readFileSync(join(root, '.gspot/package.json')),
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
        const readme = readFileSync(readmePath);
        writeFileSync(readmePath, 'authored later');
        const reinstalled = await installTools(session, log, emitAll(session), { refreshLockfiles: false });
        expect(reinstalled.exitCode, reinstalled.note).toBe(0);
        expect(readFileSync(readmePath)).toStrictEqual(readme);
        const readyTools = runner === 'none' ? ['prettier', 'ec'] : ['prettier'];
        expect(
            readyTools.map(
                (name) =>
                    inspectTool({ root, inspections: new Map() }, tools.find((tool) => tool.name === name)!).state,
            ),
        ).toStrictEqual(readyTools.map(() => 'ok'));
        if (runner === 'none') {
            expect(
                readdirSync(join(root, '.gspot/node_modules/editorconfig-checker/bin'), {
                    encoding: 'utf8',
                    recursive: true,
                }).some((path) => /(?:^|[/\\])editorconfig-checker(?:\.exe)?$/u.test(path)),
            ).toBe(true);
        }
        expect(computeDrift(root, session.policyFiles.policy, emitAll(session))).toStrictEqual([]);
        const second = writeOutputs(await openSession(root), log);
        expect(second.written).toStrictEqual([]);
        expect(readFileSync(lockfilePath)).toStrictEqual(lockfile);
        if (projectPath === 'package.json' && runner === 'mise') await expectCloneInstallation(fixture, inputs, tools);
    },
);
