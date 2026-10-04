import { stringify } from 'smol-toml';
import type { Manifest } from '#cli/types/configurations.ts';
import { pythonPins, pythonConstraints } from '#cli/tools/pins.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';
import { PYTHON_TOOL_PROJECT } from '#cli/config/parsers/packages.ts';
import { TOOL_PYTHON_PROJECT } from '#cli/config/platform/locations.ts';

/**
 * Keep Python lint dependencies in a private project owned by gspot.
 * @param manifests the selected manifests
 * @returns the private Python project files, or none without Python tools
 */
export function toolEnvironment(manifests: Manifest[]): GeneratedFile[] {
    const dependencies = pythonPins(manifests);
    if (dependencies.length === 0) return [];
    const constraints = pythonConstraints(manifests);
    return [
        {
            path: TOOL_PYTHON_PROJECT,
            content: stringify({
                project: { ...PYTHON_TOOL_PROJECT, dependencies },
                tool: {
                    uv: {
                        package: false,
                        ...(constraints.length === 0 ? {} : { 'constraint-dependencies': constraints }),
                    },
                },
            }),
            readOnly: true,
            kind: 'config',
        },
    ];
}
