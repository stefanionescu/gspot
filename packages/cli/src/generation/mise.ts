import { misePins } from '#cli/tools/mise.ts';
import { BARE_KEY } from '#cli/config/parsers/toml.ts';
import { headerFor } from '#cli/generation/headers.ts';
import type { MisePin } from '#cli/types/tools/install.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { MISE_CONFIG_PATH } from '#cli/config/platform/locations.ts';
import { GSPOT_MISE_TOOL, MISE_MIN_VERSION, GSPOT_MISE_OPTIONS } from '#cli/config/tools/mise.ts';

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
 * The native CLI and applicable mise tools, with npm dependencies kept in the isolated tool project.
 * @param manifests the selected manifests
 * @param version the gspot version
 * @returns the generated file
 */
export function miseToolsFile(manifests: Manifest[], version: string): GeneratedFile {
    const lines = [
        headerFor(MISE_CONFIG_PATH, version).trimEnd(),
        '',
        `min_version = "${MISE_MIN_VERSION}"`,
        '',
        '[tools]',
        miseToolLine({ name: GSPOT_MISE_TOOL, version, options: GSPOT_MISE_OPTIONS }),
        ...misePins(manifests).map((pin) => miseToolLine(pin)),
    ];
    return { path: MISE_CONFIG_PATH, content: `${lines.join('\n')}\n`, readOnly: true, kind: 'runner' };
}
