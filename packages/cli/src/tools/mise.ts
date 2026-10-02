import { z } from 'zod';
import { parse as parseToml } from 'smol-toml';
import { compact } from '#cli/platform/text.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import type { MisePin } from '#cli/types/tools/tools.ts';
import type { ToolPin, Manifest, InstallerPin } from '#cli/types/kits.ts';
import { collectPins, privateToolInstallation } from '#cli/tools/pins.ts';
import { HOST_ONLY, UV_INSTALLER, MISE_BACKENDS } from '#cli/config/tools/tools.ts';

/** The operating systems mise names; a tool with all three needs no os list. */
const EVERY_OS = ['macos', 'linux', 'windows'];

/**
 * The operating systems mise installs a tool on, from the platforms its manifest names.
 * @param tool the pin
 * @returns the mise os list, or undefined when every platform has a build
 */
function miseOs(tool: ToolPin): string[] | undefined {
    if (tool.platforms === undefined) return undefined;
    const os = [...new Set(tool.platforms.map((platform) => platform.replace(/-(?:x64|arm64)$/u, '')))];
    return os.length === EVERY_OS.length ? undefined : os;
}

/**
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin
 * @returns the installer pin with its backend prefix, or undefined for a host tool
 */
function misePin(tool: ToolPin): InstallerPin | undefined {
    if (tool.provider === 'host' || HOST_ONLY.has(tool.name)) return undefined;
    const backend = MISE_BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
    if (backend === undefined) return undefined;
    const pin = tool.installers[backend.installer];
    return pin === undefined ? undefined : { ...pin, name: `${backend.prefix}${pin.name}` };
}

/**
 * The pin mise installs for one tool: its version, its platforms, and its backend options.
 * @param tool the pin
 * @param isPackagePinned whether npm tools belong to the isolated package project
 * @returns the mise pin, or undefined when mise does not install the tool
 */
function pinOf(tool: ToolPin, isPackagePinned: boolean): MisePin | undefined {
    const installation = privateToolInstallation(tool, 'mise');
    const excluded = installation?.kind === 'python' || (isPackagePinned && installation?.kind === 'npm');
    const pin = excluded ? undefined : misePin(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...compact({ os: miseOs(tool), options: pin.options }) };
}

/**
 * Select only the tools installed by mise, excluding npm dependencies of the private project.
 * @param manifests the selected manifests
 * @param isPackagePinned whether npm tools belong to the isolated package project
 * @returns pins installed by mise
 */
export function misePins(manifests: Manifest[], isPackagePinned: boolean): MisePin[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => pinOf(tool, isPackagePinned) ?? []);
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
    const files = openRoot(root);
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
