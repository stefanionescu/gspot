// Select the corpus files for the selection and render them under [rules] directory, keeping the layer folders.
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import type { Session } from '#cli/run/session.ts';
import { everyManifest } from '#cli/run/session.ts';
import type { GeneratedFile } from '#types/render.ts';

export type RuleFile = { source: string; target: string; layer: string; preset: string; title: string };

const AGENT_LAYERS = new Set(['general/agent', 'general/code', 'general/prose']);

function titleOf(text: string): string {
    return text.match(/^# (.+)$/m)?.[1] ?? '';
}

/** The corpus files the selection installs, in layer order, deduplicated. */
export function selectRuleFiles(session: Session): RuleFile[] {
    const available = new Set(listAssets('rules/'));
    const files = new Map<string, RuleFile>();
    const add = (source: string, layer: string, preset: string) => {
        const path = `rules/${source}`;
        if (!available.has(path) || files.has(source)) return;
        files.set(source, {
            source,
            target: `${session.loaded.policy.rules.directory}/${source}`,
            layer,
            preset,
            title: titleOf(readAsset(path)),
        });
    };
    for (const layer of AGENT_LAYERS)
        for (const path of listAssets(`rules/${layer}/`)) add(path.slice(6), layer.split('/')[1]!, 'rules');
    for (const manifest of everyManifest(session)) {
        for (const [layer, paths] of Object.entries(manifest.rules))
            for (const path of paths) add(path, layer, manifest.preset.id);
    }
    return [...files.values()];
}

/** The rule files as generated files. Content is the corpus text unchanged. */
export function assembleRules(session: Session): GeneratedFile[] {
    if (!session.loaded.policy.rules.install) return [];
    return selectRuleFiles(session).map((file) => ({
        path: file.target,
        content: readAsset(`rules/${file.source}`),
        readOnly: true,
        kind: 'rules',
        preset: file.preset,
    }));
}
