// The tool project under .gspot: its manifest, the lock apply resolves for it, and the installation that reads both.
import { z } from 'zod';
import semver from 'semver';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isDeepStrictEqual } from 'node:util';
import { LOCKS } from '#cli/types/tools/packages.ts';
import { SETUP } from '#cli/constants/tools/tools.ts';
import type { FileSnapshot } from '#cli/types/platform.ts';
import { lockMatches } from '#cli/tools/packages/locks.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { parsePackageManager } from '#cli/tools/packages/manager.ts';
import { publishInstalledFiles } from '#cli/tools/installed-files.ts';
import type { Inputs, ToolProject } from '#cli/types/tools/packages.ts';
import type { LifecycleOwner } from '#cli/types/lifecycle/lifecycle.ts';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { TOOL_PACKAGE_PROJECT, YARN_SETTINGS } from '#cli/constants/tools/packages.ts';
import { packageCommand, packageManagerCommand, prepareNativeWrappers } from '#cli/tools/packages/resolution.ts';

const packageSchema = z.strictObject({
    name: z.literal('gspot-tools'),
    private: z.literal(true),
    type: z.literal('module'),
    packageManager: z.string(),
    devDependencies: z.record(
        z.string(),
        z.string().refine((value) => semver.valid(value) !== null),
    ),
});

// What the tool project's manifest says: its manager, its dependencies, and the lock the manager writes.
function projectOf(manifest: string): ToolProject {
    const parsed = packageSchema.parse(JSON.parse(manifest));
    const manager = parsePackageManager(parsed.packageManager);
    const lock = LOCKS[manager.name];
    return { manager, dependencies: parsed.devDependencies, lock, lockPath: `.gspot/${lock}` };
}

// Whether a recorded lock pins the project's dependencies.
function isCurrentLock(project: ToolProject, recorded: FileSnapshot | undefined): boolean {
    return (
        recorded !== undefined &&
        lockMatches(project.manager.name, recorded.bytes.toString('utf8'), project.dependencies)
    );
}

function writeProject(work: string, manifest: string, yarn: string | undefined): void {
    writeFileSync(join(work, 'package.json'), manifest);
    if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
}

// Resolves the lock in a scratch directory, starting from the recorded lock when it still matches.
async function resolveLock(
    root: string,
    project: ToolProject,
    files: GeneratedFile[],
    manifest: string,
    recorded: string | undefined,
): Promise<string> {
    const work = mkdtempSync(join(tmpdir(), 'gspot-lock-'));
    try {
        writeProject(work, manifest, files.find((file) => file.path === YARN_SETTINGS)?.content);
        if (recorded !== undefined && lockMatches(project.manager.name, recorded, project.dependencies))
            writeFileSync(join(work, project.lock), recorded);
        await packageCommand(root, work, project.manager, false);
        const content = readFileSync(join(work, project.lock), 'utf8');
        if (!lockMatches(project.manager.name, content, project.dependencies))
            throw new Error(`${project.manager.name} produced a mismatched tool lock. Existing files were preserved.`);
        return content;
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

// Refuses an installation whose inputs the manager rewrote or another writer changed meanwhile.
function assertInputsUnchanged(owner: LifecycleOwner, work: string, project: ToolProject, inputs: Inputs): void {
    const manifestKept = readFileSync(join(work, 'package.json')).equals(inputs.project.bytes);
    const lockKept = readFileSync(join(work, project.lock)).equals(inputs.recorded.bytes);
    if (!manifestKept || !lockKept)
        throw new Error(`${project.manager.name} changed locked inputs. No installed files were published. ${SETUP}`);
    const manifestSame = isDeepStrictEqual(owner.read(TOOL_PACKAGE_PROJECT), inputs.project);
    const lockSame = isDeepStrictEqual(owner.read(project.lockPath), inputs.recorded);
    if (!manifestSame || !lockSame || !isDeepStrictEqual(owner.read(YARN_SETTINGS), inputs.yarn))
        throw new Error('Tool project inputs changed during installation. Retry the command.');
}

// Installs the recorded lock in a scratch directory and publishes the installed files through the owner.
async function installFromInputs(
    root: string,
    owner: LifecycleOwner,
    project: ToolProject,
    inputs: Inputs,
    tools: Iterable<ToolPin>,
): Promise<void> {
    const work = mkdtempSync(join(tmpdir(), 'gspot-install-'));
    try {
        writeProject(work, inputs.project.bytes.toString('utf8'), inputs.yarn?.bytes.toString('utf8'));
        writeFileSync(join(work, project.lock), inputs.recorded.bytes);
        await packageCommand(root, work, project.manager, true);
        await prepareNativeWrappers(work, project.dependencies, tools);
        assertInputsUnchanged(owner, work, project, inputs);
        publishInstalledFiles(owner, join(work, 'node_modules'), 'npm');
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}

/**
 * Resolve only a missing or mismatched tool lock, before apply publishes generated files.
 * @param root the repository root
 * @param files the generated files, among them the tool project
 * @param owner the lifecycle owner that records the lock
 */
export async function resolvePackageProject(
    root: string,
    files: GeneratedFile[],
    owner: LifecycleOwner,
): Promise<void> {
    const generated = files.find((file) => file.path === TOOL_PACKAGE_PROJECT);
    if (generated === undefined) return;
    const project = projectOf(generated.content);
    const original = owner.read(project.lockPath);
    const recorded = original?.bytes.toString('utf8');
    const unchanged = owner.read(TOOL_PACKAGE_PROJECT)?.bytes.equals(Buffer.from(generated.content)) === true;
    const content =
        unchanged && recorded !== undefined && isCurrentLock(project, original)
            ? recorded
            : await resolveLock(root, project, files, generated.content, recorded);
    files.push({
        path: project.lockPath,
        content,
        readOnly: true,
        kind: 'lock',
        ...(original === undefined ? {} : { observed: original }),
    });
}

/**
 * Compare generated package requirements to the recorded native lock without resolving or writing.
 * @param root the repository root
 * @param generated the generated files, among them the tool project
 * @returns the lock path with what is wrong with it, or undefined when there is no tool project
 */
export function packageLockDrift(
    root: string,
    generated: GeneratedFile[],
): { path: string; kind?: 'missing' | 'changed' } | undefined {
    const manifest = generated.find((file) => file.path === TOOL_PACKAGE_PROJECT);
    if (manifest === undefined) return undefined;
    const project = projectOf(manifest.content);
    const files = openConfinedRoot(root);
    try {
        const recorded = files.read(project.lockPath);
        if (recorded === undefined) return { path: project.lockPath, kind: 'missing' };
        return isCurrentLock(project, recorded)
            ? { path: project.lockPath }
            : { path: project.lockPath, kind: 'changed' };
    } finally {
        files.close();
    }
}

/**
 * Validate the recorded inputs and preview native immutable commands without creating ownership state.
 * @param root the repository root
 * @returns the commands an install runs, or none without a tool project
 */
export function packageInstallSteps(root: string): string[][] {
    const files = openConfinedRoot(root);
    try {
        const manifest = files.read(TOOL_PACKAGE_PROJECT);
        if (manifest === undefined) return [];
        const project = projectOf(manifest.bytes.toString('utf8'));
        if (!isCurrentLock(project, files.read(project.lockPath))) throw new Error(SETUP);
        return [packageManagerCommand(project.manager, true)];
    } finally {
        files.close();
    }
}

/**
 * Install locked packages outside the repository, then publish each owned entry through native confinement.
 * @param root the repository root
 * @param tools the pinned tools whose native wrappers the installation prepares
 * @returns the line that says what was installed, or '' without a tool project
 */
export async function installPackageProject(root: string, tools: Iterable<ToolPin>): Promise<string> {
    return withLifecycleOwner(root, async (owner) => {
        const manifest = owner.read(TOOL_PACKAGE_PROJECT);
        if (manifest === undefined) return '';
        const project = projectOf(manifest.bytes.toString('utf8'));
        const recorded = owner.read(project.lockPath);
        if (recorded === undefined || !isCurrentLock(project, recorded)) throw new Error(SETUP);
        const inputs: Inputs = { project: manifest, recorded, yarn: owner.read(YARN_SETTINGS) };
        await installFromInputs(root, owner, project, inputs, tools);
        return `installed locked npm tools under .gspot/node_modules with ${project.manager.name}@${project.manager.version}`;
    });
}
