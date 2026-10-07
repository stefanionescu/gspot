import { readText } from '#cli/platform/source.ts';
import { parseMiseToolKeys } from '#cli/parsers/mise.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { MISE_BACKENDS } from '#cli/config/configurations.ts';
import { PRIVATE_PIN_FILES } from '#cli/config/tools/mise.ts';
import type { DuplicateMisePin } from '#cli/types/tools/install.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { misePin, misePins, collectPins, toolProjectPackage } from '#cli/configurations/pins.ts';

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
        const pin = toolProjectPackage(tool, runner);
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
