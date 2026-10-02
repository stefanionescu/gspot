// The tool project under .gspot: its manifest, the lock apply resolves for it, and the installation that reads both.
import { z } from 'zod';
import semver from 'semver';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import type { ToolOwner } from '#cli/types/tools/tools.ts';
import { lockMatches } from '#cli/tools/packages/locks.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import type { ToolPin, GeneratedFile } from '#cli/types/kits.ts';
import { installedOutputs } from '#cli/tools/installed-files.ts';
import { SETUP, TOOLS_PROJECT } from '#cli/config/tools/tools.ts';
import { parsePackageTool } from '#cli/tools/packages/identity.ts';
import { openRoot, scratchFolder } from '#cli/platform/filesystem.ts';
import type { Inputs, ToolProject } from '#cli/types/tools/packages.ts';
import { LOCKS, YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/tools/packages.ts';
import { packageCommand, packageInstallCommand, prepareNativeWrappers } from '#cli/tools/packages/commands.ts';

const packageSchema = z.strictObject({
    name: z.literal(TOOLS_PROJECT),
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
    const client = parsePackageTool(parsed.packageManager);
    const lock = LOCKS[client.name];
    return { client, dependencies: parsed.devDependencies, lock, lockPath: `.gspot/${lock}` };
}

// Whether a recorded lock pins the project's dependencies.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Four steps of apply and install ask whether the recorded lock is current; one owner keeps the comparison.
function isCurrentLock(project: ToolProject, recorded: Read | undefined): boolean {
    return (
        recorded !== undefined &&
        lockMatches(project.client.name, recorded.bytes.toString('utf8'), project.dependencies)
    );
}

function writeProject(work: string, manifest: string, yarn: string | undefined): void {
    writeFileSync(join(work, 'package.json'), manifest);
    if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
}

// Resolves the lock in a scratch directory, starting from the recorded lock when it still matches.
async function prepareLock(
    root: string,
    project: ToolProject,
    files: GeneratedFile[],
    manifest: string,
    recorded: string | undefined,
): Promise<string> {
    using workFolder = scratchFolder('gspot-lock-');
    const work = workFolder.path;
    writeProject(work, manifest, files.find((file) => file.path === YARN_SETTINGS)?.content);
    if (recorded !== undefined && lockMatches(project.client.name, recorded, project.dependencies))
        writeFileSync(join(work, project.lock), recorded);
    await packageCommand(root, work, project.client, false);
    const content = readFileSync(join(work, project.lock), 'utf8');
    if (!lockMatches(project.client.name, content, project.dependencies))
        throw new Error(`${project.client.name} produced a mismatched tool lock. Existing files were preserved.`);
    return content;
}

// Refuses an installation whose inputs the manager rewrote or another writer changed meanwhile.
function assertInputsUnchanged(owner: ToolOwner, work: string, project: ToolProject, inputs: Inputs): void {
    const manifestKept = readFileSync(join(work, 'package.json')).equals(inputs.project.bytes);
    const lockKept = readFileSync(join(work, project.lock)).equals(inputs.recorded.bytes);
    if (!manifestKept || !lockKept)
        throw new Error(`${project.client.name} changed locked inputs. No installed files were written. ${SETUP}`);
    const manifestSame = isDeepStrictEqual(owner.read(TOOL_PACKAGE_PROJECT), inputs.project);
    const lockSame = isDeepStrictEqual(owner.read(project.lockPath), inputs.recorded);
    if (!manifestSame || !lockSame || !isDeepStrictEqual(owner.read(YARN_SETTINGS), inputs.yarn))
        throw new Error('Tool project inputs changed during installation. Retry the command.');
}

// Installs the recorded lock in a scratch directory and writes the installed files through the owner.
async function installFromInputs(
    root: string,
    owner: ToolOwner,
    project: ToolProject,
    inputs: Inputs,
    tools: Iterable<ToolPin>,
): Promise<void> {
    using workFolder = scratchFolder('gspot-install-');
    const work = workFolder.path;
    writeProject(work, inputs.project.bytes.toString('utf8'), inputs.yarn?.bytes.toString('utf8'));
    writeFileSync(join(work, project.lock), inputs.recorded.bytes);
    await packageCommand(root, work, project.client, true);
    await prepareNativeWrappers(work, project.dependencies, tools);
    assertInputsUnchanged(owner, work, project, inputs);
    owner.installTree('npm', installedOutputs(join(work, 'node_modules'), 'npm'));
}

/**
 * Resolve only a missing or mismatched tool lock, before apply writes generated files.
 * @param root the repository root
 * @param files the generated files, among them the tool project
 * @param owner the lifecycle owner that records the lock
 */
export async function preparePackageProject(root: string, files: GeneratedFile[], owner: ToolOwner): Promise<void> {
    const generated = files.find((file) => file.path === TOOL_PACKAGE_PROJECT);
    if (generated === undefined) return;
    const project = projectOf(generated.content);
    const original = owner.read(project.lockPath);
    const recorded = original?.bytes.toString('utf8');
    const unchanged = owner.read(TOOL_PACKAGE_PROJECT)?.bytes.equals(Buffer.from(generated.content)) === true;
    const content =
        unchanged && recorded !== undefined && isCurrentLock(project, original)
            ? recorded
            : await prepareLock(root, project, files, generated.content, recorded);
    files.push({
        path: project.lockPath,
        content,
        readOnly: true,
        kind: 'lock',
        ...(original === undefined ? {} : { read: original }),
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
    using files = openRoot(root);
    const recorded = files.read(project.lockPath);
    if (recorded === undefined) return { path: project.lockPath, kind: 'missing' };
    return isCurrentLock(project, recorded) ? { path: project.lockPath } : { path: project.lockPath, kind: 'changed' };
}

/**
 * Validate the recorded inputs and preview native immutable commands without creating ownership state.
 * @param root the repository root
 * @returns the commands an install runs, or none without a tool project
 */
export function packageInstallSteps(root: string): string[][] {
    using files = openRoot(root);
    const manifest = files.read(TOOL_PACKAGE_PROJECT);
    if (manifest === undefined) return [];
    const project = projectOf(manifest.bytes.toString('utf8'));
    if (!isCurrentLock(project, files.read(project.lockPath))) throw new Error(SETUP);
    return [packageInstallCommand(project.client, true)];
}

/**
 * Install locked packages outside the repository, then write each owned entry through native bounds.
 * @param root the repository root
 * @param owner the owner that records the writes
 * @param tools the pinned tools to wrap
 * @returns the line that says what was installed, or '' without a tool project
 */
export async function installPackageProject(root: string, owner: ToolOwner, tools: Iterable<ToolPin>): Promise<string> {
    const manifest = owner.read(TOOL_PACKAGE_PROJECT);
    if (manifest === undefined) return '';
    const project = projectOf(manifest.bytes.toString('utf8'));
    const recorded = owner.read(project.lockPath);
    if (recorded === undefined || !isCurrentLock(project, recorded)) throw new Error(SETUP);
    const inputs: Inputs = { project: manifest, recorded, yarn: owner.read(YARN_SETTINGS) };
    await installFromInputs(root, owner, project, inputs, tools);
    return `installed locked npm tools under .gspot/node_modules with ${project.client.name}@${project.client.version}`;
}
