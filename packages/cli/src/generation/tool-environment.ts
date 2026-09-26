import { stringify } from 'smol-toml';
import { pythonPins } from '#cli/tools/pins.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';

/**
 * Keep Python lint dependencies in a private project owned by gspot.
 * @param manifests the selected manifests
 * @returns the private Python project files, or none without Python tools
 */
export function toolEnvironment(manifests: Manifest[]): GeneratedFile[] {
    const dependencies = pythonPins(manifests);
    if (dependencies.length === 0) return [];
    return [
        {
            path: '.gspot/pyproject.toml',
            content: stringify({
                project: { name: 'gspot-tools', version: '0.0.0', 'requires-python': '>=3.11', dependencies },
                tool: { uv: { package: false } },
            }),
            readOnly: true,
            kind: 'config',
        },
    ];
}
