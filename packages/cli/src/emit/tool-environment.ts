import { stringify } from 'smol-toml';
import type { Session } from '#cli/run/session.ts';
import type { GeneratedFile } from '#cli/emit/targets.ts';
import { pythonPins } from '#cli/tools/tool-installation.ts';
import { everyManifest } from '#cli/configurations/select.ts';

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
