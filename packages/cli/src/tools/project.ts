// Tool projects share lockfile drift, previews, preparation, and immutable scratch installation.
import { join, basename } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { compact } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { SETUP } from '#cli/config/tools/install.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { packageToolProject } from '#cli/tools/npm/project.ts';
import { pythonToolProject } from '#cli/tools/python/project.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import type { PythonPreparation } from '#cli/types/tools/python.ts';
import type { ToolProject, ToolProjectPlan } from '#cli/types/tools/project.ts';
import { YARN_SETTINGS, INSTALLATION_DIRECTORIES } from '#cli/config/platform/locations.ts';
import type { ToolOwner, LockfileDrift, LockfilePreparation } from '#cli/types/tools/install.ts';

function lockfileDrift<Parsed, Preparation, Installation>(
    root: string,
    description: ToolProject<Parsed, Preparation, Installation>,
    generated: GeneratedFile[],
): LockfileDrift | undefined {
    const manifest = generated.find((file) => file.path === description.manifestPath);
    if (manifest === undefined) return undefined;
    const project = description.parse(manifest.content);
    const path = description.lockfilePath(project);
    using files = openRoot(root);
    const recorded = files.read(path);
    if (recorded === undefined) return { path, kind: 'missing' };
    return description.matches(project, recorded.bytes.toString('utf8')) ? { path } : { path, kind: 'changed' };
}

// Preparation may replace a lockfile already present in the command's generated outputs.
function recordLockfile(files: GeneratedFile[], lockfile: GeneratedFile): void {
    const index = files.findIndex((file) => file.path === lockfile.path);
    if (index === -1) files.push(lockfile);
    else files[index] = lockfile;
}

/**
 * Read lockfile drift for generated tool projects without resolving or writing.
 * @param root the repository root.
 * @param generated the proposed project manifests.
 * @returns missing, mismatched, or current lockfiles.
 */
export function toolProjectDrift(root: string, generated: GeneratedFile[]): LockfileDrift[] {
    return [
        lockfileDrift(root, packageToolProject, generated),
        lockfileDrift(root, pythonToolProject, generated),
    ].filter((drift) => drift !== undefined);
}

/**
 * Preview the install command, lockfile, and environment phases without running them.
 * @param root the repository root.
 * @param description the project's native behavior.
 * @param proposed the generated manifest, or undefined to read its recorded bytes.
 * @param runner the authored installation integration.
 * @param options the lockfile preparation request.
 * @param options.refreshLockfiles resolve declared pins again.
 * @returns the native commands in their required phases.
 */
export function toolInstallationPlan<Parsed, Preparation, Installation>(
    root: string,
    description: ToolProject<Parsed, Preparation, Installation>,
    proposed: string | undefined,
    runner: string | undefined,
    { refreshLockfiles }: LockfilePreparation,
): ToolProjectPlan {
    using files = openRoot(root);
    const manifest = proposed ?? files.read(description.manifestPath)?.bytes.toString('utf8');
    if (manifest === undefined) return { installer: [], lockfile: [], environment: [] };
    const project = description.parse(manifest);
    const commands = description.commands(project, runner);
    if (
        !refreshLockfiles &&
        description.matches(project, files.read(description.lockfilePath(project))?.bytes.toString('utf8'))
    )
        commands.lockfile = [];
    return commands;
}

/**
 * Prepare one normal generated lockfile, retaining this root's observed original for its writer.
 * @param description the project's native behavior.
 * @param manifest the generated project bytes.
 * @param owner the repository reader.
 * @param options the lockfile preparation request.
 * @param options.refreshLockfiles resolve declared pins again.
 * @param preparation the native resolution inputs.
 * @returns the prepared lockfile and current root's expected read.
 */
export async function prepareToolProject<Parsed, Preparation, Installation>(
    description: ToolProject<Parsed, Preparation, Installation>,
    manifest: GeneratedFile,
    owner: Pick<ToolOwner, 'read'>,
    { refreshLockfiles }: LockfilePreparation,
    preparation: Preparation,
): Promise<GeneratedFile> {
    const project = description.parse(manifest.content);
    const path = description.lockfilePath(project);
    const original = owner.read(path);
    const recorded = refreshLockfiles ? undefined : original?.bytes.toString('utf8');
    let content = description.current(project, recorded, manifest.content, owner);
    if (content === undefined) {
        using work = scratchFolder(description.lockPrefix);
        writeFileSync(join(work.path, basename(description.manifestPath)), manifest.content);
        content = await description.createLockfile(work.path, preparation, recorded, project);
    }
    return { path, content, kind: 'lock', ...compact({ read: original }) };
}

/**
 * Append the selected npm and Python projects' lockfiles before publishing configuration.
 * @param preparation the root and command-owned Python installer.
 * @param files the generated outputs.
 * @param owner the repository reader.
 * @param options the lockfile preparation request.
 */
export async function prepareToolProjects(
    preparation: PythonPreparation,
    files: GeneratedFile[],
    owner: Pick<ToolOwner, 'read'>,
    options: LockfilePreparation,
): Promise<void> {
    const packages = files.find((file) => file.path === packageToolProject.manifestPath);
    const python = files.find((file) => file.path === pythonToolProject.manifestPath);
    if (packages !== undefined)
        recordLockfile(
            files,
            await prepareToolProject(packageToolProject, packages, owner, options, {
                root: preparation.root,
                yarn: files.find((file) => file.path === YARN_SETTINGS)?.content,
            }),
        );
    if (python !== undefined)
        recordLockfile(files, await prepareToolProject(pythonToolProject, python, owner, options, preparation));
}

/**
 * Install immutable project inputs in scratch and publish only a verified complete installation.
 * @param description the project's native behavior.
 * @param owner the reader and installation writer.
 * @param installation the native installer inputs.
 * @returns the installed-project summary, or an empty string without its manifest.
 */
export async function installToolProject<Parsed, Preparation, Installation>(
    description: ToolProject<Parsed, Preparation, Installation>,
    owner: ToolOwner,
    installation: Installation,
): Promise<string> {
    const manifest = owner.read(description.manifestPath);
    if (manifest === undefined) return '';
    const project = description.parse(manifest.bytes.toString('utf8'));
    const lockfilePath = description.lockfilePath(project);
    const lockfile = owner.read(lockfilePath);
    if (lockfile === undefined || !description.matches(project, lockfile.bytes.toString('utf8')))
        throw new GspotError('installation', SETUP);
    const inputs = new Map([
        [description.manifestPath, manifest],
        [lockfilePath, lockfile],
        ...description.additionalPaths.map((path) => [path, owner.read(path)] as const),
    ]);
    using work = scratchFolder(description.installPrefix);
    for (const [path, file] of inputs)
        if (file !== undefined) writeFileSync(join(work.path, basename(path)), file.bytes);
    const summary = await description.install(
        work.path,
        installation,
        {
            scratch: (message) => {
                if (
                    !readFileSync(join(work.path, basename(description.manifestPath))).equals(manifest.bytes) ||
                    !readFileSync(join(work.path, basename(lockfilePath))).equals(lockfile.bytes)
                )
                    throw new GspotError('installation', message);
            },
            source: (message) => {
                for (const [path, original] of inputs)
                    if (!isDeepStrictEqual(owner.read(path), original)) throw new GspotError('installation', message);
            },
        },
        project,
    );
    owner.installTree(description.kind, join(work.path, basename(INSTALLATION_DIRECTORIES[description.kind])));
    return summary;
}
