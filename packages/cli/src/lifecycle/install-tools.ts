// The install step of init and upgrade: the package.json pins, then the tool install through the runner surface.
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { detectPackageManager } from 'nypm';
import { run } from '#cli/platform/spawn.ts';
import type { Manifest } from '#types/manifest.ts';
import type { InitAnswers } from '#types/lifecycle.ts';
import type { ApplyReport, PackageContent } from '#types/emit.ts';
import { npmPins, npmScripts } from '#cli/emit/runner-surface.ts';

const PACKAGE_RUNNERS = new Set(['bun', 'npm', 'pnpm']);

function installCommands(runner: InitAnswers['runner']): string[][] {
    if (runner === 'mise') return [['mise', 'install']];
    if (runner === 'uv') return [['uv', 'sync', '--group', 'gspot']];
    return [[runner, 'install']];
}

async function runInstall(root: string, commands: string[][]): Promise<string> {
    const notes: string[] = [];
    for (const command of commands) {
        const result = await run(command, { cwd: root });
        const shown = command.join(' ');
        notes.push(
            result.code === 0
                ? `ran ${shown}`
                : `${shown} failed (exit ${String(result.code)}); gspot doctor names what is missing`,
        );
    }
    return notes.join('; ');
}

/**
 * Adds the pinned devDependencies and the gspot scripts to package.json, creating the file when there is none.
 * @param root the repository root
 * @param runner the runner surface chosen
 * @param everySelected every selected manifest
 */
export async function updatePackageJson(
    root: string,
    runner: InitAnswers['runner'],
    everySelected: Manifest[],
): Promise<void> {
    if (!PACKAGE_RUNNERS.has(runner)) return;
    const { default: manifestEditor } = await import('@npmcli/package-json');
    const manifest = existsSync(join(root, 'package.json'))
        ? await manifestEditor.load(root)
        : await manifestEditor.create(root);
    const current = manifest.content as PackageContent;
    manifest.update({
        devDependencies: { ...current.devDependencies, ...npmPins(everySelected, runner) },
        scripts: { ...current.scripts, ...npmScripts() },
    });
    await manifest.save();
}

/**
 * Installs the pinned tools through the runner surface, or says how to when --no-install was given.
 * @param root the repository root
 * @param runner the runner surface chosen
 * @param synced what apply wrote, for the package manager step mise needs
 * @param isInstalling whether init was asked to install
 * @returns the note for the summary, empty when there is no runner
 */
export async function installTools(
    root: string,
    runner: InitAnswers['runner'],
    synced: ApplyReport,
    isInstalling: boolean,
): Promise<string> {
    if (runner === 'none') return '';
    if (!isInstalling) {
        const command = runner === 'mise' ? 'mise install' : `${runner} install`;
        return `install skipped; run: ${command}`;
    }
    const commands = installCommands(runner);
    if (runner === 'mise') {
        await run(['mise', 'trust', '.config/mise/conf.d/gspot.toml'], { cwd: root });
        if (synced.packages.length > 0) {
            const detected = await detectPackageManager(root);
            commands.push([detected?.name ?? 'npm', 'install']);
        }
    }
    return runInstall(root, commands);
}
