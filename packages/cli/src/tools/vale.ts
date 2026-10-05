// Inspect and synchronize configured Vale style packages in managed storage.
import { join, dirname } from 'node:path';
import { runTool } from '#cli/tools/run.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Root } from '#cli/types/platform/root.ts';
import { parseValePackages } from '#cli/parsers/vale.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import { openRoot, walkRoot } from '#cli/platform/root/open.ts';
import type { ValeInstallation } from '#cli/types/tools/install.ts';
import { installationDiagnostics } from '#cli/tools/diagnostics.ts';
import { inspectTool, isToolAvailable } from '#cli/tools/inspect.ts';
import { PRIVATE_FILE, READ_ONLY_FILE } from '#cli/config/platform/modes.ts';
import { VALE_CONFIG, STYLES_DIRECTORY } from '#cli/config/platform/locations.ts';

// Read package names only from the private Vale configuration managed by this repository.
function configuredPackages(files: Root): string[] | undefined {
    const source = files.read(VALE_CONFIG);
    if (source === undefined) return undefined;
    return parseValePackages(source.bytes.toString('utf8'));
}

// The folder a package file belongs to: a top folder of the styles, or a folder of its config folder. A loose file
// beside the packages belongs to none.
function folderOfFile(path: string): string[] {
    const [top = '', ...rest] = path.slice(STYLES_DIRECTORY.length + 1).split('/');
    const [inner = '', ...below] = rest;
    if (top === 'config') return below.length > 0 ? [`${STYLES_DIRECTORY}/config/${inner}`] : [];
    return rest.length > 0 ? [`${STYLES_DIRECTORY}/${top}`] : [];
}

// Replaces one package folder with its synced copy: written beside it, then renamed in.
function swapPackage(files: Root, synced: Root, folder: string, paths: string[]): void {
    const next = `${folder}.next`;
    files.removeTree(next);
    for (const path of paths) {
        const content = synced.read(path);
        if (content === undefined) throw new Error(`Vale setup output disappeared: ${path}`);
        files.write(`${next}${path.slice(folder.length)}`, { bytes: content.bytes, mode: READ_ONLY_FILE }, undefined);
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

// Replaces every installed package with its synced copy, and deletes a package the configuration does not name.
function replacePackages(files: Root, work: string): void {
    using synced = openRoot(work);
    const outputs = listStyleFiles(synced).filter((path) => isValePackageFile(path));
    const folders = new Set(outputs.flatMap((path) => folderOfFile(path)));
    for (const folder of installedPackageFolders(files)) if (!folders.has(folder)) files.removeTree(folder);
    for (const folder of folders)
        swapPackage(
            files,
            synced,
            folder,
            outputs.filter((path) => path.startsWith(`${folder}/`)),
        );
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
 * @returns whether every required directory exists
 */
export function hasValePackages(root: string): boolean {
    using files = openRoot(root);
    const needed = configuredPackages(files);
    if (needed === undefined) return false;
    return needed.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory() === true);
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
 * Downloads the upstream packages the config names, and replaces the installed ones with them. Needs the network.
 * @param request the tool search, selected Vale pin, deadline, and cancellation
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installValePackages(request: ValeInstallation): Promise<string | undefined> {
    const { search, tool, timeoutSeconds, cancelSignal } = request;
    const { root } = search;
    const inspection = inspectTool(search, tool);
    if (!isToolAvailable(inspection))
        return inspection.note ?? `Vale is ${inspection.state}. ${inspection.hint ?? 'Run: gspot install'}`;
    using workFolder = scratchFolder('gspot-vale-');
    const work = workFolder.path;
    using files = openRoot(root);
    stageInputs(files, work);
    const result = await runTool([inspection.path, '--config', join(work, VALE_CONFIG), 'sync'], {
        cwd: work,
        cancelSignal,
        timeoutSeconds,
    });
    if (result.isCanceled === true) return 'Vale package sync was canceled.';
    if (result.isTimedOut === true) return 'Vale package sync exceeded its tool deadline.';
    if (result.code !== 0) return installationDiagnostics(result, []);
    replacePackages(files, work);
    return undefined;
}
