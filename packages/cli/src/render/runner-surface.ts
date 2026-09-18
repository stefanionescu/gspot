// The task-runner surface: .config/mise/conf.d/gspot.toml, package.json scripts and devDependencies, the uv dependency group.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isEmbedded } from '#cli/platform/assets.ts';
import { headerFor } from '#cli/render/templates.ts';
import type { Manifest, ToolPin } from '#types/manifest.ts';
import type { GeneratedFile } from '#types/render.ts';

const HOST_ONLY = new Set(['bash', 'git', 'docker', 'xcodebuild', 'plutil', 'xcstringstool', 'swift', 'xmllint']);

export type Pin = { tool: ToolPin; mise?: string; npm?: string; pypi?: string };

/** The mise tool name for a pin, using the backend the manifest names. */
export function misePinName(tool: ToolPin): string | undefined {
    if (tool.provider === 'host' || HOST_ONLY.has(tool.name)) return undefined;
    const { installers } = tool;
    if (installers['mise']) return installers['mise'];
    if (installers['npm']) return `npm:${installers['npm']}`;
    if (installers['pypi']) return `pipx:${installers['pypi']}`;
    if (installers['ubi']) return `ubi:${installers['ubi']}`;
    if (installers['github']) return `github:${installers['github']}`;
    if (installers['cargo']) return `cargo:${installers['cargo']}`;
    return undefined;
}

/** Every distinct tool pin across the selection, sorted by name. */
export function collectPins(manifests: Manifest[]): ToolPin[] {
    const pins = new Map<string, ToolPin>();
    for (const manifest of manifests)
        for (const tool of manifest.tools) if (!pins.has(tool.name)) pins.set(tool.name, tool);
    return [...pins.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function tomlKey(name: string): string {
    return /^[A-Za-z0-9_-]+$/.test(name) ? name : JSON.stringify(name);
}

/** .config/mise/conf.d/gspot.toml: every pin and the five gspot tasks. gspot pins itself once a release exists (D-65). */
export function miseSurface(manifests: Manifest[], version: string): GeneratedFile {
    const lines = [headerFor('.config/mise/conf.d/gspot.toml', version).trimEnd(), '', '[tools]'];
    if (isEmbedded()) lines.push(`"ubi:stefanionescu/gspot" = "${version}"`);
    for (const tool of collectPins(manifests)) {
        const name = misePinName(tool);
        if (name === undefined || tool.version === undefined) continue;
        lines.push(`${tomlKey(name)} = "${tool.version}"`);
    }
    lines.push('', '[tasks."gspot:check"]', 'description = "Run every check"', 'run = "gspot check"', '');
    lines.push(
        '[tasks."gspot:fix"]',
        'description = "Apply every fixer, then check again"',
        'run = "gspot check --fix"',
        '',
    );
    lines.push(
        '[tasks."gspot:sync"]',
        'description = "Re-render the generated files from gspot.toml"',
        'run = "gspot sync"',
        '',
    );
    lines.push(
        '[tasks."gspot:doctor"]',
        'description = "Report tools, unchecked files and what changed since init"',
        'run = "gspot doctor"',
        '',
    );
    lines.push(
        '[tasks."gspot:setup"]',
        'description = "Install the pinned tools, then the hooks and rule files"',
        'run = ["mise install", "gspot sync"]',
    );
    return { path: '.config/mise/conf.d/gspot.toml', content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}

/** The devDependencies an npm-family surface pins. */
export function npmPins(manifests: Manifest[]): Record<string, string> {
    const pins: Record<string, string> = {};
    for (const tool of collectPins(manifests))
        if (tool.installers['npm'] && tool.version) pins[tool.installers['npm']] = tool.version;
    return Object.fromEntries(Object.entries(pins).sort());
}

/** The scripts an npm-family surface writes. */
export function npmScripts(): Record<string, string> {
    return { check: 'gspot check', 'check:fix': 'gspot check --fix', sync: 'gspot sync', prepare: 'gspot sync' };
}

/** The pypi tools for the uv dependency group. */
export function uvGroup(manifests: Manifest[]): string[] {
    return collectPins(manifests)
        .filter((tool) => tool.installers['pypi'] && tool.version)
        .map((tool) => `${tool.installers['pypi']}==${tool.version}`);
}

/** Tools the repository's own mise.toml pins that gspot also pins. */
export function pinnedTwice(root: string, manifests: Manifest[]): { tool: string; version: string; place: string }[] {
    const path = join(root, 'mise.toml');
    if (!existsSync(path)) return [];
    const text = readFileSync(path, 'utf8');
    const found: { tool: string; version: string; place: string }[] = [];
    for (const tool of collectPins(manifests)) {
        const name = misePinName(tool);
        if (!name || !tool.version) continue;
        const bare = name.replace(/^[a-z]+:/, '');
        const pattern = new RegExp(
            `^\\s*"?(?:${name.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}|${bare.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')})"?\\s*=`,
            'm',
        );
        if (pattern.test(text)) found.push({ tool: tool.name, version: tool.version, place: 'mise.toml' });
    }
    return found;
}
