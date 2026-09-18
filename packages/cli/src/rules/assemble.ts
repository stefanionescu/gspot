// Select the corpus files for the selection and render them under [rules] directory, keeping the layer folders.
import type { Session } from '#types/run.ts';
import type { RuleFile } from '#types/rules.ts';
import type { GeneratedFile } from '#types/emit.ts';
import { everyManifest } from '#cli/run/session.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';

const AGENT_LAYERS = new Set(['general/agent', 'general/code', 'general/prose']);
const RULES_PREFIX = 'rules/';
const TITLE = /^# (?<title>.+)$/mu;

function titleOf(text: string): string {
    return TITLE.exec(text)?.groups?.['title'] ?? '';
}

function agentLayerFiles(): { source: string; layer: string; preset: string }[] {
    return [...AGENT_LAYERS].flatMap((layer) =>
        listAssets(`${RULES_PREFIX}${layer}/`).map((path) => ({
            source: path.slice(RULES_PREFIX.length),
            layer: layer.slice(layer.indexOf('/') + 1),
            preset: 'rules',
        })),
    );
}

function manifestFiles(session: Session): { source: string; layer: string; preset: string }[] {
    return everyManifest(session).flatMap((manifest) =>
        Object.entries(manifest.rules).flatMap(([layer, paths]) =>
            paths.map((source) => ({ source, layer, preset: manifest.preset.id })),
        ),
    );
}

/**
 * The corpus files the selection installs, in layer order, deduplicated.
 * @param session the session
 * @returns the rule files with their targets and titles
 */
export function selectRuleFiles(session: Session): RuleFile[] {
    const available = new Set(listAssets(RULES_PREFIX));
    const files = new Map<string, RuleFile>();
    for (const { source, layer, preset } of [...agentLayerFiles(), ...manifestFiles(session)]) {
        const path = `${RULES_PREFIX}${source}`;
        if (!available.has(path) || files.has(source)) continue;
        files.set(source, {
            source,
            target: `${session.policyFiles.policy.rules.directory}/${source}`,
            layer,
            preset,
            title: titleOf(readAsset(path)),
        });
    }
    return files.values().toArray();
}

/**
 * The rule files as generated files. Content is the corpus text unchanged.
 * @param session the session
 * @returns the files to write under the rules directory
 */
export function assembleRules(session: Session): GeneratedFile[] {
    if (!session.policyFiles.policy.rules.install) return [];
    return selectRuleFiles(session).map((file) => ({
        path: file.target,
        content: readAsset(`${RULES_PREFIX}${file.source}`),
        readOnly: true,
        kind: 'rules',
        preset: file.preset,
    }));
}
