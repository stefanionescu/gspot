import { BARE_KEY } from '#cli/config/parsers/toml.ts';
import { misePins } from '#cli/configurations/public.ts';
import { headerFor } from '#cli/generation/documents/contracts.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import type { MisePin, Manifest } from '#cli/types/configurations.ts';
import { CLI_PINS, GSPOT_MISE_TOOL } from '#cli/config/configurations.ts';

/**
 * One mise tool line: a bare version, or a table when the tool has platforms or backend options.
 * @param pin the pin
 * @returns the TOML line
 */
export function miseToolLine(pin: MisePin): string {
    const key = BARE_KEY.test(pin.name) ? pin.name : JSON.stringify(pin.name);
    const fields = [`version = ${JSON.stringify(pin.version)}`];
    if (pin.os !== undefined) fields.push(`os = [${pin.os.map((name) => JSON.stringify(name)).join(', ')}]`);
    for (const [name, value] of pin.options === undefined ? [] : Object.entries(pin.options))
        fields.push(`${name} = ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`);
    return fields.length === 1 ? `${key} = ${JSON.stringify(pin.version)}` : `${key} = {${fields.join(', ')}}`;
}

/**
 * The CLI and applicable mise tools, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @returns the generated file
 */
export function miseFile(manifests: Manifest[], version: string): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${CLI_PINS.mise}"`,
        '',
        '[tools]',
        miseToolLine({ name: GSPOT_MISE_TOOL, version }),
        ...misePins(manifests).map((pin) => miseToolLine(pin)),
    ];
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, kind: 'runner' };
}
