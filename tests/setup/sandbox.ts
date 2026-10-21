// Creates shared or isolated repositories for check samples.
import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { afterAll, beforeAll } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { linkPackages } from '#tests/setup/modules.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { planReplacement } from '#cli/ownership/plans.ts';
import type { FileContents } from '#cli/types/system/files.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import { VALE_TOOL_FILE_PATH } from '#cli/config/gspot-paths.ts';
import { runGspot, spawnGspot } from '#tests/setup/run-gspot.ts';
import { openWriter, writePlans } from '#cli/ownership/writer.ts';
import { isOnDisk, encodeZipArchive } from '#tests/setup/files.ts';
import { runGit, commitAll, markExecutable } from '#tests/setup/git.ts';
import { installSandbox, runSandboxStep } from '#tests/setup/install.ts';
import type { OriginalFile, SampleChanges } from '#tests/types/samples.ts';
import { PROSE_SANDBOX, VALE_PACKAGE_FILES } from '#tests/data/checks/prose.ts';
import { VALE_PACKAGES } from '#cli/config/generation/settings/builders/vale.ts';
import type { Sandbox, SandboxPlan, InstalledSandboxPlan } from '#tests/types/sandbox.ts';
import { REGISTRY_HOST, SANDBOX_GITIGNORE, SANDBOX_PACKAGE_JSON } from '#tests/data/test-setup.ts';
import { rm, open, chmod, lstat, mkdir, rmdir, unlink, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

/**
 * Name the installed npm in the root package.json, as a repository at level all must.
 *
 * @param root the sandbox folder with a package.json.
 */
export async function pinSandboxNpm(root: string): Promise<void> {
    const npm = await runCommand(['npm', '--version'], { cwd: root });
    const path = join(root, 'package.json');
    const packageJson = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
    await writeFile(
        path,
        JSON.stringify({ ...packageJson, packageManager: `npm@${npm.stdout.trim()}` }, null, JSON_INDENT) + '\n',
    );
}

/** Write the files, package.json, and tsconfig.json of a sandbox. */
async function writeSandbox(root: string, plan: SandboxPlan): Promise<void> {
    await createFileTree(root, {
        '.gitignore': SANDBOX_GITIGNORE,
        ...(plan.dependencies === undefined
            ? {}
            : {
                  'package.json':
                      JSON.stringify({ ...SANDBOX_PACKAGE_JSON, dependencies: plan.dependencies }, null, JSON_INDENT) +
                      '\n',
              }),
        ...(plan.tsconfig === undefined
            ? {}
            : { 'tsconfig.json': JSON.stringify(plan.tsconfig, null, JSON_INDENT) + '\n' }),
        ...plan.files,
    });
    if (plan.dependencies !== undefined) await pinSandboxNpm(root);
}

/** Build one isolated sandbox and run its checks in the current process. */
export async function createSandbox(plan: SandboxPlan): Promise<Sandbox & AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    const folder = resources.use(await testdir());
    await writeSandbox(folder.path, plan);
    await plan.before?.(folder.path);
    commitAll(folder.path);
    await writeFile(
        join(folder.path, 'gspot.toml'),
        buildSandboxSettings([...plan.configurations], { level: plan.level ?? 'all' }),
    );
    await plan.prepare?.(folder.path, {});
    const owned = resources.move();
    return {
        root: folder.path,
        environment: {},
        run: runGspot,
        [Symbol.asyncDispose]: owned[Symbol.asyncDispose].bind(owned),
    };
}

/** Run init in a sandbox and install the tools of one integration test file. */
export async function prepareInstalledSandbox(
    root: string,
    plan: InstalledSandboxPlan,
): Promise<Record<string, string>> {
    await writeSandbox(root, plan);
    if (plan.dependencies !== undefined) await linkPackages(join(root, 'node_modules'), Object.keys(plan.dependencies));
    await plan.before?.(root);
    commitAll(root);
    await installSandbox(
        { root, environment: {}, run: spawnGspot },
        {
            configurations: plan.configurations,
            without: [...(plan.without ?? [])],
            level: plan.level ?? 'all',
            ...(plan.install === false ? { install: false } : {}),
            prepare: plan.prepare,
        },
    );
    return {};
}

/** Share a sandbox after installing its tools once for the current test file. */
export function registerSharedSandbox(plan: InstalledSandboxPlan): () => Sandbox {
    const resources = new AsyncDisposableStack();
    let sandbox: Sandbox;
    beforeAll(async () => {
        const folder = resources.use(await testdir());
        const environment = await prepareInstalledSandbox(folder.path, plan);
        sandbox = {
            root: folder.path,
            environment,
            run: spawnGspot,
        };
    });
    afterAll(() => resources.disposeAsync());
    return () => sandbox;
}

/**
 * Resets the index entries of these paths to the last commit, which undoes what markExecutable staged on Windows.
 *
 * @param cwd the sandbox.
 * @param paths the repository-relative files.
 */
function resetIndex(cwd: string, paths: readonly string[]): void {
    if (!isWindows || paths.length === 0) return;
    const result = runGit(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}

async function readOriginalFile(path: string): Promise<OriginalFile | undefined> {
    try {
        const attributes = await lstat(path);
        if (attributes.isSymbolicLink()) return { kind: 'symlink', target: await readlink(path) };
        await using file = await open(path, 'r');
        const fileAttributes = await file.stat();
        return { kind: 'file', bytes: await file.readFile(), mode: fileAttributes.mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

async function listAbsentParents(cwd: string, paths: readonly string[]): Promise<string[]> {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && !(await isOnDisk(parent))) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

async function restoreFiles(cwd: string, originals: Map<string, OriginalFile | undefined>): Promise<void> {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        await rm(full, { force: true });
        if (original?.kind === 'symlink') await symlink(original.target, full);
        else if (original?.kind === 'file') {
            await writeFile(full, original.bytes);
            await chmod(full, original.mode);
        }
    }
}

async function removeParents(parents: string[]): Promise<void> {
    for (const path of parents) {
        try {
            await rmdir(path);
        } catch (error) {
            // Keep a folder that still holds generated or tool files; their owners remove them after the restore.
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
        }
    }
}

async function writeChanges(cwd: string, changes: SampleChanges, settings: string): Promise<void> {
    const { removed = [], executable = [] } = changes;
    for (const path of removed) await rm(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const full = join(cwd, path);
        await mkdir(dirname(full), { recursive: true });
        const original = await readOriginalFile(full);
        if (original?.kind === 'symlink') await unlink(full);
        await writeFile(full, text);
    }
    for (const path of executable) await markExecutable(cwd, path);
    await writeFile(join(cwd, 'gspot.toml'), settings);
}

// Saves file bytes and modes before the first change, so a failed change still restores them.
export async function changeSandbox(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    const cwd = sandbox.root;
    const tree = runGit(cwd, ['write-tree']).stdout.trim();
    const head = runGit(cwd, ['rev-parse', 'HEAD']).stdout.trim();
    const untracked = new Set(
        runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).stdout.split('\0').filter(Boolean),
    );
    const settingsPath = join(cwd, 'gspot.toml');
    const current = await readFile(settingsPath, 'utf8');
    const base = changes.files['gspot.toml'] ?? current;
    const settings = [base, changes.settings].filter((text) => text !== undefined).join('\n');
    const gone = changes.removed ?? [];
    const executables = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(changes.files)])];
    const originals = new Map<string, OriginalFile | undefined>();
    for (const path of paths) originals.set(path, await readOriginalFile(join(cwd, path)));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = await listAbsentParents(cwd, paths);
    const restore = async (): Promise<void> => {
        await restoreFiles(cwd, originals);
        await removeParents(parents);
        resetIndex(cwd, executables);
    };
    try {
        await writeChanges(cwd, changes, settings);
    } catch (error) {
        await restore();
        throw error;
    }
    return {
        async [Symbol.asyncDispose]() {
            for (const path of runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
                .stdout.split('\0')
                .filter(Boolean))
                if (!untracked.has(path)) await rm(join(cwd, path), { force: true });
            await restore();
            const reset = runGit(cwd, ['reset', '--soft', head]);
            if (reset.code !== 0) throw new Error(reset.stderr);
            const restored = runGit(cwd, ['read-tree', tree]);
            if (restored.code !== 0) throw new Error(restored.stderr);
        },
    };
}

/** Change the sandbox for a test that applies, and apply again after the restore so the generated files match. */
export async function updateSandbox(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    const change = await changeSandbox(sandbox, changes);
    return {
        async [Symbol.asyncDispose]() {
            await change[Symbol.asyncDispose]();
            await runSandboxStep(sandbox, ['apply']);
        },
    };
}
/** Share a prose sandbox whose Vale packages come from the local package server. */
export function shareProseSandbox(): () => Sandbox {
    let server: ReturnType<typeof Bun.serve>;
    beforeAll(() => {
        const archive = encodeZipArchive(
            Object.entries(VALE_PACKAGE_FILES).map(([path, content]) => [path, Buffer.from(content)] as const),
        );
        server = Bun.serve({ hostname: REGISTRY_HOST, port: 0, fetch: () => new Response(new Uint8Array(archive)) });
    });
    function pointValePackages(root: string): void {
        const packages = VALE_PACKAGES.map((name) => `http://${REGISTRY_HOST}:${String(server.port)}/${name}.zip`).join(
            ', ',
        );
        using writer = openWriter(root);
        const file = writer.files.read(VALE_TOOL_FILE_PATH) as FileContents;
        writePlans(writer, [
            planReplacement(writer, {
                path: VALE_TOOL_FILE_PATH,
                next: {
                    bytes: Buffer.from(
                        file.bytes.toString('utf8').replace(/^Packages = .*$/mu, `Packages = ${packages}`),
                    ),
                    mode: 0o444,
                },
            }),
        ]);
    }
    const sandbox = registerSharedSandbox({
        ...PROSE_SANDBOX,
        prepare: pointValePackages,
    });
    afterAll(async () => {
        await server.stop(true);
    });
    return () => ({
        ...sandbox(),
        async run(root, commandArguments, environment) {
            const result = await spawnGspot(root, commandArguments, environment);
            if (commandArguments[0] === 'apply' && result.code === 0) pointValePackages(root);
            return result;
        },
    });
}

/** Write the sample files and run apply; disposal restores the files and applies again. */
export async function applySandboxChanges(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await updateSandbox(sandbox, changes));
    await runSandboxStep(sandbox, ['apply']);
    return resources.move();
}

/** Write and stage the sample files, then run apply; disposal restores the index and files. */
export async function applyStagedSandboxChanges(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await updateSandbox(sandbox, changes));
    const staged = runGit(sandbox.root, ['add', '--all']);
    if (staged.code !== 0) throw new Error(`Staging sandbox inputs failed: ${staged.stderr}${staged.stdout}`);
    await runSandboxStep(sandbox, ['apply']);
    return resources.move();
}

/** Write the generated files for an existing test repository. */
export async function applyGeneratedFiles(root: string): Promise<void> {
    using writer = openWriter(root);
    const session = await openSession(root);
    writeGeneratedFiles(session, generate(session), writer);
}
