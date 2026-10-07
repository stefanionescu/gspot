// The tool project under .gspot: its generated manifest, prepared lockfile, and installation.
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { compact } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { scratchFolder } from '#cli/platform/scratch.ts';
import type { InstallFiles } from '#cli/types/tools/npm.ts';
import type { ToolPin } from '#cli/types/configurations.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { lockfileMatches } from '#cli/tools/npm/lockfiles.ts';
import type { ToolProject } from '#cli/types/parsers/packages.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { YARN_SETTINGS, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';
import type { ToolOwner, LockfileDrift, LockfilePreparation } from '#cli/types/tools/install.ts';

import {
    installArgv,
    lockfileArgv,
    assertPackageVersions,
    installPackageLockfile,
    preparePackageLockfile,
} from '#cli/tools/npm/install.ts';

// The recorded lockfile text when it still pins the project's dependencies.
function getCurrentLockfile(project: ToolProject, recorded: string | undefined): string | undefined {
    if (recorded === undefined || !lockfileMatches(project.installer.name, recorded, project.dependencies))
        return undefined;
    return recorded;
}

function writeProject(work: string, manifest: string, yarn: string | undefined): void {
    writeFileSync(join(work, 'package.json'), manifest);
    if (yarn !== undefined) writeFileSync(join(work, '.yarnrc.yml'), yarn);
}

// Resolves the lockfile in a scratch directory, starting from the recorded lockfile when it still matches.
async function prepareLockfile(
    root: string,
    project: ToolProject,
    yarn: string | undefined,
    manifest: string,
    recorded: string | undefined,
): Promise<string> {
    using workFolder = scratchFolder('gspot-lockfile-');
    const work = workFolder.path;
    writeProject(work, manifest, yarn);
    const current = getCurrentLockfile(project, recorded);
    if (current !== undefined) writeFileSync(join(work, project.lockfile), current);
    await preparePackageLockfile(root, work, project.installer);
    const content = readFileSync(join(work, project.lockfile), 'utf8');
    if (getCurrentLockfile(project, content) === undefined)
        throw new GspotError(
            'installation',
            `${project.installer.name} produced a mismatched tool lockfile. Existing files were preserved.`,
        );
    return content;
}

// Refuses an installation whose inputs the manager rewrote or another writer changed meanwhile.
function assertInputsUnchanged(owner: ToolOwner, work: string, project: ToolProject, inputs: InstallFiles): void {
    const manifestKept = readFileSync(join(work, 'package.json')).equals(inputs.project.bytes);
    const lockfileKept = readFileSync(join(work, project.lockfile)).equals(inputs.recorded.bytes);
    if (!manifestKept || !lockfileKept)
        throw new GspotError(
            'installation',
            `${project.installer.name} changed locked inputs. No installed files were written. ${SETUP}`,
        );
    const manifestSame = isDeepStrictEqual(owner.read(TOOL_PACKAGE_PROJECT), inputs.project);
    const lockfileSame = isDeepStrictEqual(owner.read(project.lockfilePath), inputs.recorded);
    if (!manifestSame || !lockfileSame || !isDeepStrictEqual(owner.read(YARN_SETTINGS), inputs.yarn))
        throw new GspotError('installation', 'Tool project inputs changed during installation. Retry the command.');
}

// Installs the recorded lockfile in a scratch directory and writes the installed files through the owner.
async function installFromInputs(
    root: string,
    owner: ToolOwner,
    project: ToolProject,
    inputs: InstallFiles,
    tools: Iterable<ToolPin>,
): Promise<void> {
    using workFolder = scratchFolder('gspot-install-');
    const work = workFolder.path;
    writeProject(work, inputs.project.bytes.toString('utf8'), inputs.yarn?.bytes.toString('utf8'));
    writeFileSync(join(work, project.lockfile), inputs.recorded.bytes);
    await installPackageLockfile(root, work, project.installer);
    await assertPackageVersions(work, project.dependencies, tools);
    assertInputsUnchanged(owner, work, project, inputs);
    owner.installTree('npm', join(work, 'node_modules'));
}

/**
 * Prepare a missing or mismatched tool lockfile before initialization publishes configuration.
 * @param root the repository root.
 * Appends the successfully prepared lockfile to files.
 * @param files the generated files, among them the tool project.
 * @param owner the lifecycle owner that records the lockfile.
 * @param options the caller's lockfile preparation request.
 * @param options.refreshLockfiles resolve from the declared pins without reusing the recorded lockfile.
 */
export async function preparePackageProject(
    root: string,
    files: GeneratedFile[],
    owner: Pick<ToolOwner, 'read'>,
    { refreshLockfiles }: LockfilePreparation,
): Promise<void> {
    const generated = files.find((file) => file.path === TOOL_PACKAGE_PROJECT);
    if (generated === undefined) return;
    const project = parseToolProject(generated.content);
    const original = owner.read(project.lockfilePath);
    const recorded = refreshLockfiles ? undefined : original?.bytes.toString('utf8');
    const unchanged = owner.read(TOOL_PACKAGE_PROJECT)?.bytes.equals(Buffer.from(generated.content)) === true;
    const current = unchanged ? getCurrentLockfile(project, recorded) : undefined;
    const content =
        current ??
        (await prepareLockfile(
            root,
            project,
            files.find((file) => file.path === YARN_SETTINGS)?.content,
            generated.content,
            recorded,
        ));
    files.push({
        path: project.lockfilePath,
        content,
        readOnly: true,
        kind: 'lock',
        ...compact({ read: original }),
    });
}

/**
 * Check whether the recorded lockfile still pins the generated package.json without resolving or writing.
 * @param root the repository root.
 * @param generated the generated files, among them the tool project.
 * @returns the lockfile path with what is wrong with it, or undefined when there is no tool project.
 */
export function packageLockfileDrift(root: string, generated: GeneratedFile[]): LockfileDrift | undefined {
    const manifest = generated.find((file) => file.path === TOOL_PACKAGE_PROJECT);
    if (manifest === undefined) return undefined;
    const project = parseToolProject(manifest.content);
    using files = openRoot(root);
    const recorded = files.read(project.lockfilePath);
    if (recorded === undefined) return { path: project.lockfilePath, kind: 'missing' };
    return getCurrentLockfile(project, recorded.bytes.toString('utf8')) === undefined
        ? { path: project.lockfilePath, kind: 'changed' }
        : { path: project.lockfilePath };
}

/**
 * The commands gspot install runs to prepare the lockfile and install the npm tools.
 * @param root the repository root.
 * @param proposed the generated package manifest, when previewing uncommitted output.
 * @param refreshLockfiles include fresh lockfile resolution even when the recorded pins match.
 * @returns the commands an install runs, or none without a tool project.
 */
export function packageInstallSteps(root: string, proposed?: string, refreshLockfiles = false): string[][] {
    using files = openRoot(root);
    const manifest = proposed ?? files.read(TOOL_PACKAGE_PROJECT)?.bytes.toString('utf8');
    if (manifest === undefined) return [];
    const project = parseToolProject(manifest);
    const lockfilePreparation =
        refreshLockfiles ||
        getCurrentLockfile(project, files.read(project.lockfilePath)?.bytes.toString('utf8')) === undefined
            ? [lockfileArgv(project.installer)]
            : [];
    return [...lockfilePreparation, installArgv(project.installer)];
}

/**
 * Install locked npm tools in a scratch folder, then write them to .gspot/node_modules.
 * @param root the repository root.
 * @param owner the owner that records the writes.
 * @param tools the pinned tools to wrap.
 * @returns the line that says what was installed, or '' without a tool project.
 */
export async function installPackageProject(root: string, owner: ToolOwner, tools: Iterable<ToolPin>): Promise<string> {
    const manifest = owner.read(TOOL_PACKAGE_PROJECT);
    if (manifest === undefined) return '';
    const project = parseToolProject(manifest.bytes.toString('utf8'));
    const recorded = owner.read(project.lockfilePath);
    if (recorded === undefined || getCurrentLockfile(project, recorded.bytes.toString('utf8')) === undefined)
        throw new GspotError('installation', SETUP);
    const inputs: InstallFiles = { project: manifest, recorded, yarn: owner.read(YARN_SETTINGS) };
    await installFromInputs(root, owner, project, inputs, tools);
    return `installed locked npm tools under .gspot/node_modules with ${project.installer.name}@${project.installer.version}`;
}
