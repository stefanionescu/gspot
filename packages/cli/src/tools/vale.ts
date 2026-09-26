import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { run } from '#cli/platform/spawn.ts';
import { locateTool } from '#cli/tools/probe.ts';
import { toPosix } from '#cli/platform/paths.ts';
import { basename, dirname, join, relative } from 'node:path';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { PRIVATE_FILE, READ_ONLY_FILE } from '#cli/constants/platform.ts';
import { isValePackageFile } from '#cli/repository/file-classification.ts';
import { readOwnership, withLifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { STYLES_DIRECTORY, VALE_CONFIG } from '#cli/constants/configurations.ts';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';

/**
 * True when every upstream package is present under the styles directory.
 * @param root the repository root
 * @param requireOwnership require matching recorded package bytes and modes for setup
 * @returns whether vale sync has run
 */
export function hasPackages(root: string, requireOwnership = false): boolean {
    const files = openConfinedRoot(root);
    try {
        const source = files.read(VALE_CONFIG);
        if (source === undefined) return false;
        const configured = /^Packages = (.*)$/mu.exec(source.bytes.toString('utf8'))?.[1] ?? '';
        const packages = configured
            .split(',')
            .map((name) => name.trim())
            .filter((name) => name !== '')
            .map((name) => basename(/^https?:\/\//u.test(name) ? new URL(name).pathname : name).replace(/\.zip$/u, ''));
        // Harper requires the dictionaries installed beside its styles.
        const needed = [...packages, ...(packages.includes('Harper') ? ['config/dictionaries'] : [])];
        if (!needed.every((name) => files.stat(`${STYLES_DIRECTORY}/${name}`)?.isDirectory() === true)) return false;
        if (!requireOwnership || packages.length === 0) return true;
        const selected = (path: string) =>
            isValePackageFile(path) && needed.some((name) => path.startsWith(`${STYLES_DIRECTORY}/${name}/`));
        const recorded = new Map(
            readOwnership(root)
                .files.filter((entry) => selected(entry.path))
                .map((entry) => [entry.path, entry.installed]),
        );
        const installed: string[] = [];
        const visit = (directory: string): void => {
            for (const name of files.list(directory)) {
                const path = `${directory}/${name}`;
                if (files.stat(path)?.isDirectory() === true) visit(path);
                else if (selected(path)) installed.push(path);
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
    return withLifecycleOwner(root, async (owner) => {
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
            const staged = openConfinedRoot(work);
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
                const proposals = outputs.map((output) => {
                    const current = owner.read(output.path);
                    const mode = current?.bytes.equals(output.content.bytes) === true ? current.mode : READ_ONLY_FILE;
                    return owner.proposeReplacement(output.path, { bytes: output.content.bytes, mode }, 'config');
                });
                const retained = new Set(outputs.map((output) => output.path));
                proposals.push(
                    ...owner
                        .installedPaths()
                        .filter((path) => isValePackageFile(path) && !retained.has(path))
                        .map((path) => owner.proposeRestoration(path)),
                );
                const conflict = proposals.find((proposal) => proposal.status === 'preserved');
                if (conflict !== undefined) return `preserved edited or unowned ${conflict.path}`;
                owner.applyProposals(proposals);
            } finally {
                staged.close();
            }
            return undefined;
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    });
}
