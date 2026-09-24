import { stringify } from 'smol-toml';
import type { Session } from '#cli/types/execution.ts';
import { collectPins } from '#cli/emit/runner-tasks.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { everyManifest } from '#cli/configurations/select.ts';
import { privateToolInstallation } from '#cli/tools/tool-installation.ts';

/**
 * Select exact Python tool requirements from their implementation owners.
 * @param manifests
 */
export function pythonPins(manifests: Manifest[]): string[] {
    return collectPins(manifests).flatMap((tool) => {
        const installation = privateToolInstallation(tool);
        return installation?.kind === 'python' ? [`${installation.name}==${installation.version}`] : [];
    });
}

/**
 * Keep Python lint dependencies in a private project owned by gspot.
 * @param session
 */
export function toolEnvironment(session: Session): GeneratedFile[] {
    const dependencies = pythonPins(everyManifest(session));
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
