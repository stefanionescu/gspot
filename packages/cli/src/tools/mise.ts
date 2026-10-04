import { compact } from '#cli/platform/objects.ts';
import { readText } from '#cli/platform/source.ts';
import { parseMiseToolKeys } from '#cli/parsers/mise.ts';
import { pythonPins, collectPins } from '#cli/tools/pins.ts';
import { PRIVATE_PIN_FILES } from '#cli/config/tools/mise.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { privateToolInstallation } from '#cli/tools/installation.ts';
import type { MisePin, DuplicateMisePin } from '#cli/types/tools/install.ts';
import type { ToolPin, Manifest, InstallerPin } from '#cli/types/configurations.ts';
import { EVERY_OS, UV_INSTALLER, MISE_BACKENDS } from '#cli/config/tools/install.ts';

/**
 * The operating systems mise installs a tool on, from the platforms its manifest names.
 * @param tool the pin.
 * @returns the mise os list, or undefined when every platform has a build.
 */
function miseOs(tool: ToolPin): string[] | undefined {
    if (tool.platforms === undefined) return undefined;
    const os = [...new Set(tool.platforms.map((platform) => platform.replace(/-(?:x64|arm64)$/u, '')))];
    return os.length === EVERY_OS.length ? undefined : os;
}

/**
 * The pin mise installs for one tool: its version, its platforms, and its backend options.
 * @param tool the pin.
 * @returns the mise pin, or undefined when mise does not install the tool.
 */
function pinOf(tool: ToolPin): MisePin | undefined {
    const excluded = privateToolInstallation(tool, 'mise') !== undefined;
    const pin = excluded ? undefined : misePin(tool);
    if (pin?.version === undefined) return undefined;
    return { name: pin.name, version: pin.version, ...compact({ os: miseOs(tool), options: pin.options }) };
}

/**
 * The mise package and version, using the backend the manifest names.
 * @param tool the pin.
 * @returns the installer pin with its backend prefix, or undefined for a host tool.
 */
export function misePin(tool: ToolPin): InstallerPin | undefined {
    if (tool.system === true) return undefined;
    const backend = MISE_BACKENDS.find(({ installer }) => tool.installers[installer] !== undefined);
    if (backend === undefined) return undefined;
    const pin = tool.installers[backend.installer];
    return pin === undefined ? undefined : { ...pin, name: `${backend.prefix}${pin.name}` };
}

/**
 * Select tools that mise installs. Omit tools in private npm and Python projects.
 * @param manifests the selected manifests.
 * @returns pins installed by mise.
 */
export function misePins(manifests: Manifest[]): MisePin[] {
    const tools = collectPins(manifests);
    const pins = tools.flatMap((tool) => pinOf(tool) ?? []);
    if (pythonPins(manifests).length > 0) pins.push(UV_INSTALLER);
    return pins;
}

/**
 * Tools the repository's own mise.toml pins that gspot also pins.
 * @param root the repository root.
 * @param manifests the manifests containing applicable tool requirements.
 * @param runner the selected task runner.
 * @returns each duplicate and the generated file holding the gspot pin.
 */
export function duplicateMisePins(root: string, manifests: Manifest[], runner: string | undefined): DuplicateMisePin[] {
    const source = readText(root, 'mise.toml');
    const keys = source === undefined ? new Set<string>() : parseMiseToolKeys(source);
    const tools = collectPins(manifests);
    const aliases = new Map(
        tools.map((tool) => [
            tool.name,
            [
                tool.name,
                ...MISE_BACKENDS.flatMap((backend) => {
                    const pin = tool.installers[backend.installer];
                    return pin === undefined ? [] : [pin.name, `${backend.prefix}${pin.name}`];
                }),
            ],
        ]),
    );
    const found: DuplicateMisePin[] = tools.flatMap((tool) => {
        const pin = privateToolInstallation(tool, runner);
        return pin === undefined
            ? []
            : [{ tool: tool.name, version: pin.version, gspotFile: PRIVATE_PIN_FILES[pin.kind] }];
    });
    if (runner === 'mise') {
        const names = new Map(
            tools.flatMap((tool) => {
                const pin = misePin(tool);
                return pin === undefined ? [] : [[pin.name, tool.name]];
            }),
        );
        found.push(
            ...misePins(manifests).map((pin) => ({
                tool: names.get(pin.name) ?? pin.name,
                version: pin.version,
                gspotFile: MISE_CONFIG_PATH,
            })),
        );
    }
    return found.filter((pin) => (aliases.get(pin.tool) ?? [pin.tool]).some((name) => keys.has(name)));
}
