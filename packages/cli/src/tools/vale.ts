import { tmpdir } from 'node:os';
import { run } from '#cli/platform/spawn.ts';
import type { Root } from '#cli/types/platform.ts';
import { locateTool } from '#cli/tools/inspect.ts';
import { join, dirname, basename } from 'node:path';
import { openRoot } from '#cli/platform/filesystem.ts';
import { isValePackageFile } from '#cli/repository/kind.ts';
import type { Session } from '#cli/types/execution/execution.ts';
import { VALE_CONFIG, STYLES_DIRECTORY } from '#cli/config/kits.ts';
import { PRIVATE_FILE, READ_ONLY_FILE } from '#cli/config/platform.ts';
import { rmSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';

// Harper also installs dictionaries beside its styles.
function packageDirectories(files: Root): string[] | undefined {
    const source = files.read(VALE_CONFIG);
    if (source === undefined) return undefined;
    const configured = /^Packages = (.*)$/mu.exec(source.bytes.toString('utf8'))?.[1] ?? '';
    const packages = configured
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name !== '')
        .map((name) => basename(/^https?:\/\//u.test(name) ? new URL(name).pathname : name).replace(/\.zip$/u, ''));
    if (packages.includes('Harper')) packages.push('config/dictionaries');
    return packages;
}

// The folder a package file belongs to: a top folder of the styles, or a folder of its config folder. A loose file
// beside the packages belongs to none.
function packageFolder(path: string): string[] {
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
    files.rename(next, folder);
}

// Copies the Vale configuration and the gspot style into the folder vale sync runs in.
function stageInputs(files: Root, work: string): void {
    const inputs = [VALE_CONFIG, ...styleFiles(files).filter((path) => !isValePackageFile(path))];
    for (const path of inputs) {
        const content = files.read(path);
        if (content === undefined) throw new Error(`Vale setup input is missing: ${path}`);
        mkdirSync(dirname(join(work, path)), { recursive: true });
        writeFileSync(join(work, path), content.bytes, { mode: PRIVATE_FILE });
    }
}

// Replaces every installed package with its synced copy, and deletes a package the configuration does not name.
function replacePackages(files: Root, work: string): void {
    const synced = openRoot(work);
    try {
        const outputs = styleFiles(synced).filter((path) => isValePackageFile(path));
        const folders = new Set(outputs.flatMap((path) => packageFolder(path)));
        for (const folder of packageFolders(files)) if (!folders.has(folder)) files.removeTree(folder);
        for (const folder of folders)
            swapPackage(
                files,
                synced,
                folder,
                outputs.filter((path) => path.startsWith(`${folder}/`)),
            );
    } finally {
        synced.close();
    }
}

/**
 * Check whether configured upstream styles are available for a prose check.
 * @param root the repository root
 * @returns whether every required directory exists
 */
export function hasPackages(root: string): boolean {
    const files = openRoot(root);
    try {
        const needed = packageDirectories(files);
        if (needed === undefined) return false;
        return needed.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory() === true);
    } finally {
        files.close();
    }
}

/**
 * Every file under the styles folder, whether it belongs to a Vale package or to the gspot style.
 * @param files the root the styles folder is read from
 * @returns the files, relative to the root
 */
export function styleFiles(files: Root): string[] {
    const found: string[] = [];
    const visit = (directory: string): void => {
        for (const name of files.list(directory)) {
            const path = `${directory}/${name}`;
            if (files.stat(path)?.isDirectory() === true) visit(path);
            else found.push(path);
        }
    };
    visit(STYLES_DIRECTORY);
    return found;
}

/**
 * The package folders under the styles folder.
 * @param files the repository root
 * @returns the folders, relative to the root
 */
export function packageFolders(files: Root): string[] {
    const packageFiles = styleFiles(files).filter((path) => isValePackageFile(path));
    const folders = new Set(packageFiles.flatMap((path) => packageFolder(path)));
    return [...folders];
}

/**
 * Deletes every installed package folder.
 * @param root the repository root
 */
export function removePackages(root: string): void {
    const files = openRoot(root);
    try {
        for (const folder of packageFolders(files)) files.removeTree(folder);
    } finally {
        files.close();
    }
}

/**
 * Downloads the upstream packages the config names, and replaces the installed ones with them. Needs the network.
 * @param root the repository root
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installPackages(root: string): Promise<string | undefined> {
    const binary = locateTool(root, 'vale');
    if (binary === undefined) return 'vale is not installed';
    const work = mkdtempSync(join(tmpdir(), 'gspot-vale-'));
    const files = openRoot(root);
    try {
        stageInputs(files, work);
        const result = await run([binary, '--config', join(work, VALE_CONFIG), 'sync'], { cwd: work });
        if (result.code !== 0) return result.stderr.trim() || result.stdout.trim();
        replacePackages(files, work);
        return undefined;
    } finally {
        files.close();
        rmSync(work, { recursive: true, force: true });
    }
}

/**
 * Install the Vale packages when a scope selects the prose kit and none are installed. The packages are not tracked, so a
 * clone gets them from apply or install.
 * @param session the open session
 * @returns undefined when nothing was needed, an empty result after the install, or the problem when it failed
 */
export async function installProsePackages(session: Session): Promise<{ problem?: string } | undefined> {
    const isProse = session.scopes.some((selection) =>
        selection.selected.some((manifest) => manifest.kit.name === 'prose'),
    );
    if (!isProse || hasPackages(session.root)) return undefined;
    const problem = await installPackages(session.root);
    return problem === undefined ? {} : { problem };
}
