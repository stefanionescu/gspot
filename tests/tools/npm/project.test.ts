import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { inspectTool } from '#cli/tools/inspect.ts';
import { emitAll } from '#cli/generation/outputs.ts';
import { computeDrift } from '#cli/lifecycle/drift.ts';
import { writeOutputs } from '#cli/lifecycle/apply.ts';
import { openSession } from '#cli/execution/session.ts';
import { installTools } from '#cli/lifecycle/install.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { commitAll, gitOutput } from '#tests/harness/git.ts';
import { PACKAGE_PROJECTS } from '#tests/config/harness/npm.ts';
import { openOwnership } from '#cli/lifecycle/ownership/log.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { readPackageInputs, createPackageProject } from '#tests/harness/npm.ts';
import type { PackageInputs, PackageProject } from '#tests/types/harness/npm.ts';
import { statSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

/** A clean clone installs its committed lock twice without changing tracked files. */
async function expectCloneInstallation(
    project: PackageProject,
    inputs: PackageInputs,
    tools: ToolPin[],
): Promise<void> {
    const { root, artifacts } = project;
    const { manifest, lock } = inputs;
    const clone = join(artifacts, 'clone');
    commitAll(root);
    gitOutput(root, ['clone', '--quiet', '--no-local', root, clone]);
    expect(existsSync(join(clone, '.gspot/node_modules'))).toBe(false);
    expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        using cloneLog = openOwnership(clone);
        const cloneInstall = await installTools(await openSession(clone), cloneLog, { refreshLocks: false });
        expect(cloneInstall.exitCode, cloneInstall.note).toBe(0);
        expect(cloneInstall.note).toContain('.gspot/node_modules');
        const status = await runTestCommand(['git', 'status', '--porcelain'], { cwd: clone });
        expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
        // Git for Windows may change checkout line endings while preserving the committed lock.
        expect(readFileSync(join(clone, '.gspot', basename(inputs.lockPath)), 'utf8').replaceAll('\r\n', '\n')).toBe(
            lock.toString('utf8').replaceAll('\r\n', '\n'),
        );
        expect(readFileSync(join(clone, '.gspot/package.json'))).toStrictEqual(manifest);
    }
    const prettier = tools.find((tool) => tool.name === 'prettier')!;
    expect(inspectTool({ root: clone, inspections: new Map() }, prettier).state).toBe('ok');
}

test.each(PACKAGE_PROJECTS)(
    '%s from %s with %s preserves authored and locked inputs and restores edited tool files',
    async (installer, projectPath, runner) => {
        await using fixture = await createPackageProject(installer, projectPath, runner);
        const { root, artifacts, rootPackage, yarnConfiguration } = fixture;
        const { tools } = fixture;
        using log = openOwnership(root);
        const inputs = readPackageInputs(root, installer);
        const { manifest, lockPath, lock, mode } = inputs;
        setEnvironmentVariable('YARN_CACHE_FOLDER', join(artifacts, 'installation-cache'));
        setEnvironmentVariable('YARN_GLOBAL_FOLDER', join(artifacts, 'installation-global'));
        const installed = await installTools(await openSession(root), log, { refreshLocks: false });
        expect(installed.exitCode, installed.note).toBe(0);
        expect(installed.note).toContain('.gspot/node_modules');
        const workspace = join(root, 'pnpm-workspace.yaml');
        const yarnrc = join(root, '.yarnrc.yml');
        expect({
            authored: readFileSync(join(root, projectPath), 'utf8'),
            workspace: existsSync(workspace) ? readFileSync(workspace, 'utf8') : undefined,
            yarnrc: existsSync(yarnrc) ? readFileSync(yarnrc, 'utf8') : undefined,
            dependencies: readFileSync(join(root, 'node_modules/authored.txt'), 'utf8'),
            lock: readFileSync(lockPath),
            mode: statSync(lockPath).mode,
            manifest: readFileSync(join(root, '.gspot/package.json')),
        }).toStrictEqual({
            authored: rootPackage,
            workspace: projectPath === 'package.json' ? 'packages:\n  - "**"\n' : undefined,
            yarnrc: yarnConfiguration,
            dependencies: 'keep project dependencies',
            lock,
            mode,
            manifest,
        });
        // A reinstall replaces an edited installed file with the locked one, and the tool stays ready.
        const readmePath = join(root, '.gspot/node_modules/prettier/README.md');
        const readme = readFileSync(readmePath);
        writeFileSync(readmePath, 'authored later');
        const reinstalled = await installTools(await openSession(root), log, { refreshLocks: false });
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
        const session = await openSession(root);
        expect(computeDrift(root, session.policyFiles.policy, emitAll(session))).toStrictEqual([]);
        const second = writeOutputs(await openSession(root), log);
        expect(second.written).toStrictEqual([]);
        expect(readFileSync(lockPath)).toStrictEqual(lock);
        if (projectPath === 'package.json' && runner === 'mise') await expectCloneInstallation(fixture, inputs, tools);
    },
);
