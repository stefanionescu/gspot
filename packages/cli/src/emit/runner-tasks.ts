// The task runner: .config/mise/conf.d/gspot.toml, package.json scripts and devDependencies, the uv dependency group.
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { headerFor } from '#cli/emit/templates.ts';
import type { GeneratedFile } from '#types/emit.ts';
import { isEmbedded } from '#cli/platform/assets.ts';
import type { Manifest, ToolPin, InstallerPin } from '#types/manifest.ts';

const HOST_ONLY = new Set(['bash', 'git', 'docker', 'xcodebuild', 'plutil', 'xcstringstool', 'swift', 'xmllint']);
const BARE_KEY = /^[\w-]+$/u;
const MISE_PATH = '.config/mise/conf.d/gspot.toml';
const BACKENDS: { installer: string; prefix: string }[] = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'ubi', prefix: 'ubi:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
];
const MISE_TASKS = [
    '',
    '[tasks."gspot:check"]',
    'description = "Run every check"',
    'run = "gspot check"',
    '',
    '[tasks."gspot:fix"]',
    'description = "Apply every fixer, then check again"',
    'run = "gspot check --fix"',
    '',
    '[tasks."gspot:apply"]',
    'description = "Re-render the generated files from gspot.toml"',
    'run = "gspot apply"',
    '',
    '[tasks."gspot:doctor"]',
    'description = "Report tools, unchecked files and what changed since init"',
    'run = "gspot doctor"',
    '',
    '[tasks."gspot:setup"]',
    'description = "Install the pinned tools, then the hooks and rule files"',
    'run = ["mise install", "gspot apply"]',
];

function tomlKey(name: string): string {
    return BARE_KEY.test(name) ? name : JSON.stringify(name);
}

function unquoted(text: string): string {
    const trimmed = text.trim();
    return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

function tomlKeys(text: string): Set<string> {
    const keys = new Set<string>();
    for (const line of text.split('\n')) {
        const equals = line.indexOf('=');
        if (equals !== -1) keys.add(unquoted(line.slice(0, equals)));
    }
    return keys;
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
    const backend = BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
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
 * The mise file: every pin and the five gspot tasks. npm tools go to package.json when the repository has one. gspot pins itself once a release exists (D-65).
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether npm tools are pinned in package.json instead
 * @returns the generated file
 */
export function miseTasks(manifests: Manifest[], version: string, isPackagePinned: boolean): GeneratedFile {
    const lines = [headerFor(MISE_PATH, version).trimEnd(), '', '[tools]'];
    if (isEmbedded()) lines.push(`"ubi:stefanionescu/gspot" = "${version}"`);
    for (const tool of collectPins(manifests)) {
        if (isPinnedInPackage(tool, isPackagePinned)) continue;
        const pin = misePin(tool);
        if (pin?.version === undefined) continue;
        lines.push(`${tomlKey(pin.name)} = "${pin.version}"`);
    }
    lines.push(...MISE_TASKS);
    return { path: MISE_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
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
    return { check: 'gspot check', 'check:fix': 'gspot check --fix', apply: 'gspot apply', prepare: 'gspot apply' };
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
    const keys = tomlKeys(readFileSync(path, 'utf8'));
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
