import { misePins } from '#cli/tools/mise.ts';
import { BARE_KEY } from '#cli/config/generation.ts';
import { headerFor } from '#cli/generation/headers.ts';
import type { MisePin, Manifest } from '#cli/types/kits.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { MISE_CONFIG_PATH, MISE_MIN_VERSION } from '#cli/config/tools/tools.ts';

/**
 * One mise tool line: a bare version, or a table when the tool has platforms or backend options.
 * @param pin the pin
 * @returns the TOML line
 */
export function miseToolLine(pin: MisePin): string {
    const key = BARE_KEY.test(pin.name) ? pin.name : JSON.stringify(pin.name);
    const fields = [`version = ${JSON.stringify(pin.version)}`];
    if (pin.os !== undefined) fields.push(`os = [${pin.os.map((name) => JSON.stringify(name)).join(', ')}]`);
    for (const [name, value] of Object.entries(pin.options ?? {}))
        fields.push(`${name} = ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`);
    return fields.length === 1 ? `${key} = ${JSON.stringify(pin.version)}` : `${key} = {${fields.join(', ')}}`;
}

/**
 * Mise tool pins, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @param isPackagePinned whether the private npm project pins the tools instead
 * @returns the generated file
 */
export function miseToolsFile(manifests: Manifest[], version: string, isPackagePinned: boolean): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${MISE_MIN_VERSION}"`,
        '',
        '[tools]',
        `"npm:@gspothq/cli" = "${version}"`,
        ...misePins(manifests, isPackagePinned).map((pin) => miseToolLine(pin)),
    ];
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}
