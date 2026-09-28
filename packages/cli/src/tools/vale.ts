import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { toPosix } from '#cli/platform/paths.ts';
import type { Root } from '#cli/types/platform.ts';
import { locateTool } from '#cli/tools/inspect.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { join, dirname, basename, relative } from 'node:path';
import { VALE_CONFIG, STYLES_DIRECTORY } from '#cli/config/kits.ts';
import { PRIVATE_FILE, READ_ONLY_FILE } from '#cli/config/platform.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { readOwnership, runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { rmSync, mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';

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
 * Verify installed styles against the lifecycle record before setup reuses them.
 * @param root the repository root
 * @returns whether every configured package has its recorded bytes and modes
 */
export function hasOwnedPackages(root: string): boolean {
    const files = openRoot(root);
    try {
        const needed = packageDirectories(files);
        if (needed === undefined) return false;
        if (!needed.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory() === true)) return false;
        if (needed.length === 0) return true;
        const recorded = new Map(
            readOwnership(root)
                .files.filter(
                    (entry) =>
                        isValePackageFile(entry.path) &&
                        needed.some((name) => entry.path.startsWith(`${STYLES_DIRECTORY}/${name}/`)),
                )
                .map((entry) => [entry.path, entry.installed]),
        );
        const installed: string[] = [];
        const visit = (directory: string): void => {
            for (const name of files.list(directory)) {
                const path = `${directory}/${name}`;
                if (files.stat(path)?.isDirectory() === true) visit(path);
                else if (
                    isValePackageFile(path) &&
                    needed.some((name) => path.startsWith(`${STYLES_DIRECTORY}/${name}/`))
                )
                    installed.push(path);
            }
        };
        for (const name of needed) visit(`${STYLES_DIRECTORY}/${name}`);
        return (
            needed.every((name) => installed.some((path) => path.startsWith(`${STYLES_DIRECTORY}/${name}/`))) &&
            [...new Set([...installed, ...recorded.keys()])].every((path) => {
                const content = files.read(path);
                const identity = recorded.get(path);
                return (
                    content !== undefined &&
                    content.mode === identity?.mode &&
                    createHash('sha256').update(content.bytes).digest('hex') === identity.hash
                );
            })
        );
    } finally {
        files.close();
    }
}

/**
 * Downloads the upstream packages the config names. Needs the network; runs at setup.
 * @param root the repository root
 * @returns what went wrong, or undefined when the packages are in place
 */
export async function installPackages(root: string): Promise<string | undefined> {
    const binary = locateTool(root, 'vale');
    if (binary === undefined) return 'vale is not installed';
    return runOwnedLifecycle(root, async (owner) => {
        const work = mkdtempSync(join(tmpdir(), 'gspot-vale-'));
        try {
            const inputs = [
                VALE_CONFIG,
                ...owner
                    .installedPaths()
                    .filter((path) => path.startsWith(`${STYLES_DIRECTORY}/`) && !isValePackageFile(path)),
            ];
            for (const path of inputs) {
                const content = owner.read(path);
                if (content === undefined) throw new Error(`Vale setup input is missing: ${path}`);
                mkdirSync(dirname(join(work, path)), { recursive: true });
                writeFileSync(join(work, path), content.bytes, { mode: PRIVATE_FILE });
            }
            const result = await run([binary, '--config', join(work, VALE_CONFIG), 'sync'], { cwd: work });
            if (result.code !== 0) return result.stderr.trim() || result.stdout.trim();
            const staged = openRoot(work);
            try {
                if (staged.stat(STYLES_DIRECTORY)?.isDirectory() !== true)
                    throw new Error('Vale did not produce a styles directory.');
                const outputs = readdirSync(join(work, STYLES_DIRECTORY), { recursive: true, withFileTypes: true })
                    .filter((entry) => !entry.isDirectory())
                    .map((entry) => {
                        const path = toPosix(relative(work, join(entry.parentPath, entry.name)));
                        const content = staged.read(path);
                        if (content === undefined) throw new Error(`Vale setup output disappeared: ${path}`);
                        return { path, content };
                    })
                    .filter((entry) => isValePackageFile(entry.path));
                const plans = outputs.map((output) => {
                    const current = owner.read(output.path);
                    const mode = current?.bytes.equals(output.content.bytes) === true ? current.mode : READ_ONLY_FILE;
                    return owner.proposeReplacement(output.path, { bytes: output.content.bytes, mode }, 'config');
                });
                const retained = new Set(outputs.map((output) => output.path));
                plans.push(
                    ...owner
                        .installedPaths()
                        .filter((path) => isValePackageFile(path) && !retained.has(path))
                        .map((path) => owner.proposeRestoration(path)),
                );
                const conflict = plans.find((plan) => plan.status === 'preserved');
                if (conflict !== undefined) return `preserved edited or unowned ${conflict.path}`;
                owner.applyPlans(plans);
                return undefined;
            } finally {
                staged.close();
            }
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    });
}
