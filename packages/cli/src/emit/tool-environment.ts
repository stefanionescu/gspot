import { stringify } from 'smol-toml';
import { collectPins } from '#cli/emit/runner-tasks.ts';
import { everyManifest } from '#cli/presets/select.ts';
import type { Session } from '#types/run.ts';
import type { Manifest } from '#types/manifest.ts';
import type { GeneratedFile } from '#types/emit.ts';

/** Select exact Python tool requirements from their implementation owners. */
export function pythonPins(manifests: Manifest[]): string[] {
    return collectPins(manifests).flatMap((tool) => {
        if (tool.provider === 'host') return [];
        const pin = tool.installers['pypi'];
        return pin?.version === undefined ? [] : [`${pin.name}==${pin.version}`];
    });
}

/** Keep Python lint dependencies in a private project owned by gspot. */
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
