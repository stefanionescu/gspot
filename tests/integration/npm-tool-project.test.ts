import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { inspectTool } from '#cli/tools/find.ts';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { findStaleFiles } from '#cli/apply/stale.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { installTools } from '#cli/install/install.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { git, commitAll, gitOutput } from '#tests/setup/git.ts';
import { toolProjectLockfile } from '#cli/parsers/tool-project.ts';
import type { ToolDeclaration } from '#cli/types/configurations.ts';
import { TOOL_PROJECT_BYTE_ATTRIBUTES } from '#tests/config/git.ts';
import { createNpmClientSandbox } from '#tests/setup/npm-clients.ts';
import { NPM_CLIENT_ROWS, NPM_REGISTRY_TOKEN } from '#tests/config/npm.ts';
import prettierManifest from 'prettier/package.json' with { type: 'json' };
import type { ToolProjectFiles, NpmClientSandbox } from '#tests/types/npm.ts';
import { writeLockedInputs, readToolProjectFiles } from '#tests/setup/install.ts';
import { stat, chmod, unlink, readFile, writeFile, appendFile } from 'node:fs/promises';

test.each(NPM_CLIENT_ROWS.filter(([, path]) => path === 'package.json'))(
    '%s from %s: apply keeps a stale lockfile and install repairs it',
    async (installer, projectPath) => {
        await using sandbox = await createNpmClientSandbox(installer, projectPath);
        const { root, registry } = sandbox;
        await writeLockedInputs(root);
        const { lockfilePath, lockfile } = await readToolProjectFiles(root, installer);
        expect(Buffer.from(lockfile).toString('utf8')).not.toContain(NPM_REGISTRY_TOKEN);
        for (let attempt = 0; attempt < 2; attempt++) {
            const applied = await spawnGspot(root, ['apply', '--json']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        }
        // Yarn 1 writes resolved package addresses into its lockfile; these must exclude the private registry.
        if (installer === 'yarn') expect(Buffer.from(lockfile).toString('utf8')).not.toContain(registry.url);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        await writeFile(lockfilePath, stale);
        const staleApply = await spawnGspot(root, ['apply', '--json']);
        expect(staleApply.code, staleApply.stdout + staleApply.stderr).toBe(0);
        expect(await readFile(lockfilePath, 'utf8')).toBe(stale);
        const read = await openSession(root);
        expect(findStaleFiles(read, emitAll(read))).toContainEqual({
            path: `.gspot/${toolProjectLockfile(installer)}`,
            kind: 'changed',
        });
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout)).toMatchObject({ installed: true });
        expect(await readFile(lockfilePath, 'utf8')).not.toBe(stale);
        const repaired = await openSession(root);
        expect(findStaleFiles(repaired, emitAll(repaired))).not.toContainEqual({
            path: `.gspot/${toolProjectLockfile(installer)}`,
            kind: 'changed',
        });
    },
);

test.each(NPM_CLIENT_ROWS.filter(([, path]) => path === 'package.json'))(
    '%s from %s keeps a conflicted lockfile through apply until the packageManager pin is fixed, and install repairs it',
    async (installer, projectPath) => {
        await using sandbox = await createNpmClientSandbox(installer, projectPath);
        const { root, rootPackage } = sandbox;
        await writeLockedInputs(root);
        const { manifest, lockfilePath, lockfile } = await readToolProjectFiles(root, installer);
        const stale = Buffer.from(lockfile).toString('utf8').replaceAll(prettierManifest.version, '0.0.0');
        await chmod(lockfilePath, 0o644);
        const conflict = `<<<<<<< edited\n${stale}\n=======\n${Buffer.from(lockfile).toString('utf8')}\n>>>>>>> generated\n`;
        await writeFile(lockfilePath, conflict);
        await writeFile(
            join(root, projectPath),
            JSON.stringify({ ...JSON.parse(rootPackage), packageManager: `${installer}@99.0.0` }),
        );
        const refused = await spawnGspot(root, ['install', '--json']);
        expect(refused.code, refused.stdout + refused.stderr).toBe(2);
        expect(refused.stdout).toContain('Install that package manager version first');
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        expect(await readFile(join(root, '.gspot/package.json'))).toStrictEqual(Buffer.from(manifest));
        await writeFile(join(root, projectPath), rootPackage);
        let repaired: ReturnType<typeof writeGeneratedFiles>;
        {
            using log = openWriter(root);
            const session = await openSession(root);
            repaired = writeGeneratedFiles(session, emitAll(session), log);
        }
        expect(repaired.written).not.toContain(`.gspot/${toolProjectLockfile(installer)}`);
        expect(await readFile(lockfilePath, 'utf8')).toBe(conflict);
        const installed = await spawnGspot(root, ['install', '--json']);
        expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        expect(JSON.parse(installed.stdout)).toMatchObject({ installed: true });
        expect(repaired.notes.filter((note) => note.startsWith('preserved'))).toStrictEqual([]);
        expect(await readFile(lockfilePath, 'utf8')).not.toContain('<<<<<<<');
    },
);

/** A clean clone installs its committed lockfile twice without changing tracked files. */
async function expectCloneInstallation(
    project: NpmClientSandbox,
    inputs: ToolProjectFiles,
    tools: ToolDeclaration[],
): Promise<void> {
    const { root, artifacts } = project;
    const { manifest, lockfile } = inputs;
    const clone = join(artifacts, 'clone');
    // Preserve native package-manager line endings through Git before testing installation byte preservation.
    await appendFile(join(root, '.gitattributes'), TOOL_PROJECT_BYTE_ATTRIBUTES);
    commitAll(root);
    gitOutput(root, ['clone', '--quiet', '--no-local', root, clone]);
    expect(await pathExists(join(clone, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(clone, '.gspot/state/ownership.json'))).toBe(false);
    for (let attempt = 0; attempt < 2; attempt++) {
        using cloneLog = openWriter(clone);
        const { session } = await writeLockedInputs(clone, cloneLog);
        const cloneInstall = await installTools(session, cloneLog, emitAll(session));
        expect(cloneInstall.exitCode, cloneInstall.note).toBe(0);
        expect(cloneInstall.note).toContain('.gspot/node_modules');
        const status = git(clone, ['status', '--porcelain']);
        expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
        expect(await readFile(join(clone, '.gspot', basename(inputs.lockfilePath)))).toStrictEqual(
            Buffer.from(lockfile),
        );
        expect(await readFile(join(clone, '.gspot/package.json'))).toStrictEqual(Buffer.from(manifest));
    }
    const prettier = tools.find((tool) => tool.name === 'prettier')!;
    expect(inspectTool(await openSession(clone), prettier).state).toBe('ok');
}

test.each([...NPM_CLIENT_ROWS])(
    '%s from %s preserves authored and locked inputs and restores edited tool files',
    async (installer, projectPath) => {
        await using sandbox = await createNpmClientSandbox(installer, projectPath);
        const { root, rootPackage, yarnConfiguration, tools } = sandbox;
        using log = openWriter(root);
        const { session, inputs } = await writeLockedInputs(root, log);
        const { manifest, lockfilePath, lockfile, mode } = inputs!;
        const installed = await installTools(session, log, emitAll(session));
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
        const reinstalled = await installTools(session, log, emitAll(session));
        expect(reinstalled.exitCode, reinstalled.note).toBe(0);
        expect(await readFile(readmePath)).toStrictEqual(readme);
        const readyTools = ['prettier', 'editorconfig-checker'];
        const refreshed = await openSession(root);
        expect(
            readyTools.map((name) => inspectTool(refreshed, tools.find((tool) => tool.name === name)!).state),
        ).toStrictEqual(readyTools.map(() => 'ok'));
        expect(findStaleFiles(session, emitAll(session))).toStrictEqual([]);
        const second = await openSession(root).then((refreshed) =>
            writeGeneratedFiles(refreshed, emitAll(refreshed), log),
        );
        expect(second.written).toStrictEqual([]);
        expect(await readFile(lockfilePath)).toStrictEqual(Buffer.from(lockfile));
        if (projectPath === 'package.json') await expectCloneInstallation(sandbox, inputs!, tools);
    },
);
