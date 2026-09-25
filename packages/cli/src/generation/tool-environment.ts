import type { Manifest } from '#cli/configurations/read-manifests.ts';
import type { GeneratedFile } from '#cli/generation/targets.ts';
import { pythonPins } from '#cli/tools/installation.ts';
import { stringify } from 'smol-toml';

/**
 * Keep Python lint dependencies in a private project owned by gspot.
 * @param manifests
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
