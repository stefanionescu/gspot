// Inspect and synchronize shipped Vale style packages in managed storage.
import { runTool } from '#cli/tools/run.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { join, dirname, relative } from 'node:path';
import type { Root } from '#cli/types/platform/root.ts';
import type { Policy } from '#cli/types/policy/settings.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { openRoot, walkRoot } from '#cli/platform/root/open.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';
import type { ValeInstallation } from '#cli/types/tools/install.ts';
import { installationDiagnostics } from '#cli/tools/credentials.ts';
import { inspectTool, isToolAvailable } from '#cli/tools/inspect.ts';
import { scratchFolder, scratchEntries } from '#cli/platform/scratch.ts';
import { lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PRIVATE_FILE, READ_ONLY_FILE } from '#cli/config/platform/modes.ts';
import { VALE_CONFIG, STYLES_DIRECTORY } from '#cli/config/platform/locations.ts';

// The folder a package file belongs to: a top folder of the styles, or a folder of its config folder. A loose file
// beside the packages belongs to none.
function folderOfFile(path: string): string[] {
    const [top = '', ...rest] = path.slice(STYLES_DIRECTORY.length + 1).split('/');
    const [inner = '', ...below] = rest;
    if (top === 'config') return below.length > 0 ? [`${STYLES_DIRECTORY}/config/${inner}`] : [];
    return rest.length > 0 ? [`${STYLES_DIRECTORY}/${top}`] : [];
}

// Replaces one package folder with its installed copy: written beside it, then renamed in.
function swapPackage(files: Root, work: string, folder: string, paths: string[]): void {
    const next = `${folder}.next`;
    files.removeTree(next);
    for (const path of paths) {
        const bytes = readFileSync(join(work, path));
        files.write(`${next}${path.slice(folder.length)}`, { bytes, mode: READ_ONLY_FILE }, undefined);
    }
    files.removeTree(folder);
    files.renameDirectory(next, folder);
}

// Copies the Vale configuration and the gspot style into the folder vale sync runs in.
function stageInputs(files: Root, work: string): void {
    const inputs = [VALE_CONFIG, ...listStyleFiles(files).filter((path) => !isValePackageFile(path))];
    for (const path of inputs) {
        const content = files.read(path);
        if (content === undefined) throw new Error(`Vale setup input is missing: ${path}`);
        mkdirSync(dirname(join(work, path)), { recursive: true });
        writeFileSync(join(work, path), content.bytes, { mode: PRIVATE_FILE });
    }
}

// Replaces every installed package with its installed copy, and deletes a package the configuration does not name.
function replacePackages(files: Root, work: string): string | undefined {
    const missing = VALE_PACKAGE_FOLDERS.find((folder) => {
        const path = `${STYLES_DIRECTORY}/${folder}`;
        const entry = lstatSync(join(work, path), { throwIfNoEntry: false });
        if (entry?.isSymbolicLink() === true) throw new Error(`Unsafe lifecycle destination: ${path}`);
        return entry?.isDirectory() !== true;
    });
    if (missing !== undefined) return `Vale setup output is missing: ${STYLES_DIRECTORY}/${missing}`;
    const outputs = Array.from(scratchEntries(join(work, STYLES_DIRECTORY)), (entry) => {
        const path = toPosix(relative(work, join(entry.parentPath, entry.name)));
        if (entry.isSymbolicLink()) throw new Error(`Unsafe lifecycle destination: ${path}`);
        if (!entry.isFile() || lstatSync(join(work, path)).nlink !== 1)
            throw new Error(`Lifecycle destination is not a private regular file: ${path}`);
        return path;
    }).filter((path) => isValePackageFile(path));
    const folders = new Set(outputs.flatMap((path) => folderOfFile(path)));
    for (const folder of installedPackageFolders(files)) if (!folders.has(folder)) files.removeTree(folder);
    for (const folder of folders)
        swapPackage(
            files,
            work,
            folder,
            outputs.filter((path) => path.startsWith(`${folder}/`)),
        );
    return undefined;
}

/**
 * The package folders under the styles folder.
 * @param files the repository root
 * @returns the folders, relative to the root
 */
function installedPackageFolders(files: Root): string[] {
    const packageFiles = listStyleFiles(files).filter((path) => isValePackageFile(path));
    const folders = new Set(packageFiles.flatMap((path) => folderOfFile(path)));
    return [...folders];
}

/**
 * Check whether configured upstream styles are available for a prose check.
 * @param root the repository root
 * @param level the selected check level
 * @returns whether the config and required package directories exist
 */
export function hasValePackages(root: string, level: Policy['level']): boolean {
    using files = openRoot(root);
    if (files.read(VALE_CONFIG) === undefined) return false;
    if (level === 'recommended') return true;
    return VALE_PACKAGE_FOLDERS.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory() === true);
}

/**
 * Every file under the styles folder, whether it belongs to a Vale package or to the gspot style.
 * @param files the root the styles folder is read from
 * @returns the files, relative to the root
 */
export function listStyleFiles(files: Root): string[] {
    const found: string[] = [];
    walkRoot(files, STYLES_DIRECTORY, (path) => {
        if (files.stat(path)?.isDirectory() === true) return true;
        found.push(path);
        return false;
    });
    return found;
}

/**
 * Deletes every installed package folder.
 * @param root the repository root
 */
export function removeValePackages(root: string): void {
    using files = openRoot(root);
    for (const folder of installedPackageFolders(files)) files.removeTree(folder);
}

/**
 * Downloads the upstream packages shipped at the selected level, and replaces the installed ones with them. Needs the network.
 * @param request the tool search, selected Vale pin, deadline, and cancellation
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installValePackages(request: ValeInstallation): Promise<string | undefined> {
    const { search, tool, level, timeoutSeconds, cancelSignal } = request;
    const { root } = search;
    using files = openRoot(root);
    using workFolder = scratchFolder('gspot-vale-');
    const work = workFolder.path;
    stageInputs(files, work);
    if (level === 'recommended') return undefined;
    const inspection = inspectTool(search, tool);
    if (!isToolAvailable(inspection))
        return inspection.note ?? `Vale is ${inspection.state}. ${inspection.hint ?? 'Run: gspot install'}`;
    const result = await runTool([inspection.path, '--config', join(work, VALE_CONFIG), 'sync'], {
        cwd: work,
        cancelSignal,
        timeoutSeconds,
    });
    if (result.isCanceled === true) return 'Vale package sync was canceled.';
    if (result.isTimedOut === true) return 'Vale package sync exceeded its tool deadline.';
    if (result.code !== 0) return installationDiagnostics(result, []);
    return replacePackages(files, work);
}
