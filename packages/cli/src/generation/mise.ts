import { stringify } from '@decimalturn/toml-patch';
import { listMisePins } from '#cli/configurations/tools.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation/files.ts';
import { MISE_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/generation/tool-file-sources.ts';

/**
 * Emit the program tool project without repository runtime pins.
 *
 * @param manifests the selected configuration manifests.
 *
 * @returns the mise tool project.
 */
export function miseFile(manifests: Manifest[]): GeneratedFile {
    const tools = Object.fromEntries(
        listMisePins(manifests).map((pin) => [
            pin.name,
            pin.options === undefined ? pin.version : { version: pin.version, ...pin.options },
        ]),
    );
    return {
        path: MISE_TOOL_PROJECT_FILE,
        content: stringify({ tools }, { ...TOOL_EMIT_FORMAT, inlineTableStart: 1 }),
        kind: 'tool_file',
    };
}
