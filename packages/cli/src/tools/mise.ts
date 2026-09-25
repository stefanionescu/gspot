import type { InstallerPin, Manifest, ToolPin } from '#cli/configurations/manifests.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { MISE_BACKENDS, UV_INSTALLER, collectPins, privateToolInstallation } from '#cli/tools/pins.ts';
import { parse as parseToml } from 'smol-toml';
import { z } from 'zod';
const HOST_ONLY = new Set(['bash', 'git', 'docker', 'xcodebuild', 'plutil', 'xcstringstool', 'swift', 'xmllint']);

export const MISE_CONFIG_PATH = '.mise/conf.d/gspot-tools.toml';

export const MISE_MIN_VERSION = '2026.8.8';

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
 * Select only the tools installed by mise, excluding npm dependencies of the private project.
 * @param manifests the selected manifests
 * @param isPackagePinned whether npm tools belong to the isolated package project
 * @returns pins installed by mise
 */
export function misePins(manifests: Manifest[], isPackagePinned: boolean): (InstallerPin & { version: string })[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => {
        const installation = privateToolInstallation(tool, 'mise');
        if (installation?.kind === 'python' || (isPackagePinned && installation?.kind === 'npm')) return [];
        const pin = misePin(tool);
        return pin?.version === undefined ? [] : [{ name: pin.name, version: pin.version }];
    });
    if (tools.some((tool) => tool.provider !== 'host' && tool.installers['pypi']?.version !== undefined))
        pins.push(UV_INSTALLER);
    return pins;
}

/**
 * Tools the repository's own mise.toml pins that gspot also pins.
 * @param root the repository root
 * @param manifests the selected manifests
 * @returns each tool pinned twice, with the file that pins it
 */
export function pinnedTwice(root: string, manifests: Manifest[]): { tool: string; version: string; place: string }[] {
    const files = openConfinedRoot(root);
    let current;
    try {
        current = files.read('mise.toml');
    } finally {
        files.close();
    }
    if (current === undefined) return [];
    const config = z
        .object({ tools: z.record(z.string(), z.unknown()).optional() })
        .parse(parseToml(current.bytes.toString('utf8')));
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
