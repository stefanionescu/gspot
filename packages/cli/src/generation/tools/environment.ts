import { stringify } from 'smol-toml';
import { TOOLS_PROJECT } from '#cli/config/tools/tools.ts';
import type { Manifest, GeneratedFile } from '#cli/types/kits.ts';
import { pythonPins, pythonConstraints } from '#cli/tools/pins.ts';

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
            path: '.gspot/pyproject.toml',
            content: stringify({
                project: { name: TOOLS_PROJECT, version: '0.0.0', 'requires-python': '>=3.11', dependencies },
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
