import { z } from 'zod';
// Mise tool pins and task definitions; npm tools belong to the isolated package project.
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { existsSync, readFileSync } from 'node:fs';
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile } from '#types/emit.ts';
import { isEmbedded } from '#cli/platform/assets.ts';
import { MISE_BACKENDS, UV_INSTALLER } from '#config/installers.ts';
import type { Manifest, ToolPin, InstallerPin } from '#types/manifest.ts';

const HOST_ONLY = new Set(['bash', 'git', 'docker', 'xcodebuild', 'plutil', 'xcstringstool', 'swift', 'xmllint']);
const BARE_KEY = /^[\w-]+$/u;
const MISE_CONFIG_PATH = '.mise/conf.d/gspot-tools.toml';
const MISE_MIN_VERSION = '2026.8.8';
const MISE_TASKS = [
    { name: 'gspot:check', description: 'Run selected checks', run: 'gspot check' },
    { name: 'gspot:fix', description: 'Apply corrections and check again', run: 'gspot check --fix' },
    { name: 'gspot:apply', description: 'Generate configuration from gspot.toml', run: 'gspot apply' },
    { name: 'gspot:doctor', description: 'Report tools, coverage, and configuration changes', run: 'gspot doctor' },
];

function tomlKey(name: string): string {
    return BARE_KEY.test(name) ? name : JSON.stringify(name);
}

function isPinnedInPackage(tool: ToolPin, isPackagePinned: boolean): boolean {
    return isPackagePinned && tool.installers['npm'] !== undefined && tool.installers['mise'] === undefined;
}

/**
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin
 * @returns the installer pin with its backend prefix, or undefined for a host tool
 */
export function misePin(tool: ToolPin): InstallerPin | undefined {
    if (tool.provider === 'host' || HOST_ONLY.has(tool.name)) return undefined;
    const backend = MISE_BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
    if (backend === undefined) return undefined;
    const pin = tool.installers[backend.installer];
    return pin === undefined ? undefined : { ...pin, name: `${backend.prefix}${pin.name}` };
}

/**
 * Every distinct tool pin across the selection, sorted by name.
 * @param manifests the selected manifests
 * @returns the pins
 */
export function collectPins(manifests: Manifest[]): ToolPin[] {
    const pins = new Map<string, ToolPin>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) if (!pins.has(tool.name)) pins.set(tool.name, tool);
    return pins
        .values()
        .toArray()
        .toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Select only the tools installed by mise, excluding npm dependencies of the private project.
 * @param manifests the selected manifests
 * @param isPackagePinned whether npm tools belong to the isolated package project
 * @returns pins installed by mise
 */
export function misePins(manifests: Manifest[], isPackagePinned: boolean): (InstallerPin & { version: string })[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => {
        if (isPinnedInPackage(tool, isPackagePinned) || tool.installers['pypi'] !== undefined) return [];
        const pin = misePin(tool);
        return pin?.version === undefined ? [] : [{ name: pin.name, version: pin.version }];
    });
    if (tools.some((tool) => tool.provider !== 'host' && tool.installers['pypi']?.version !== undefined))
        pins.push(UV_INSTALLER);
    return pins;
}

/**
 * Mise pins and tasks, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether npm tools are pinned in .gspot/package.json instead
 * @returns the generated file
 */
export function miseTasks(manifests: Manifest[], version: string, isPackagePinned: boolean): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${MISE_MIN_VERSION}"`,
        '',
        '[tools]',
    ];
    if (isEmbedded()) lines.push(`"github:stefanionescu/gspot" = "${version}"`);
    for (const pin of misePins(manifests, isPackagePinned)) lines.push(`${tomlKey(pin.name)} = "${pin.version}"`);
    for (const task of MISE_TASKS)
        lines.push(
            '',
            `[tasks.${JSON.stringify(task.name)}]`,
            `description = ${JSON.stringify(task.description)}`,
            `run = ${JSON.stringify(task.run)}`,
        );
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}

/**
 * The devDependencies an npm-family task runner pins.
 * @param manifests the selected manifests
 * @param runner the task runner; under mise, tools mise can pin stay out
 * @returns package name to version, sorted
 */
export function npmPins(manifests: Manifest[], runner = 'npm'): Record<string, string> {
    const pins: [string, string][] = [];
    for (const tool of collectPins(manifests)) {
        const pin = tool.installers['npm'];
        if (pin?.version === undefined) continue;
        if (runner === 'mise' && tool.installers['mise'] !== undefined) continue;
        pins.push([pin.name, pin.version]);
    }
    return Object.fromEntries(pins.toSorted(([a], [b]) => a.localeCompare(b)));
}

/**
 * The scripts an npm-family task runner writes.
 * @returns script name to command
 */
export function npmScripts(): Record<string, string> {
    return { check: 'gspot check', 'check:fix': 'gspot check --fix', apply: 'gspot apply' };
}

/**
 * Tools the repository's own mise.toml pins that gspot also pins.
 * @param root the repository root
 * @param manifests the selected manifests
 * @returns each tool pinned twice, with the file that pins it
 */
export function pinnedTwice(root: string, manifests: Manifest[]): { tool: string; version: string; place: string }[] {
    const path = join(root, 'mise.toml');
    if (!existsSync(path)) return [];
    const config = z
        .object({ tools: z.record(z.string(), z.unknown()).optional() })
        .parse(parseToml(readFileSync(path, 'utf8')));
    const keys = new Set(Object.keys(config.tools ?? {}));
    const found: { tool: string; version: string; place: string }[] = [];
    for (const tool of collectPins(manifests)) {
        const pin = misePin(tool);
        if (pin?.version === undefined) continue;
        const bare = pin.name.slice(pin.name.indexOf(':') + 1);
        if (keys.has(pin.name) || keys.has(bare))
            found.push({ tool: tool.name, version: pin.version, place: 'mise.toml' });
    }
    return found;
}

export { MISE_CONFIG_PATH, MISE_MIN_VERSION, MISE_TASKS };
