import { nearMatches } from '#cli/policy/near.ts';
import type { Policy } from '#cli/policy/normalize.ts';
// Select the rule files for the selection and render them under [rules] directory, keeping the layer folders.
import type { RuleFile } from '#cli/agents/instructions.ts';
import { listAssets, readAsset } from '#cli/platform/assets.ts';
import type { GeneratedFile } from '#cli/generation/proposal.ts';
import type { Manifest } from '#cli/configurations/manifests.ts';

const AGENT_LAYERS = new Set(['general/agent', 'general/code', 'general/prose']);
const RULES_PREFIX = 'packages/cli/rules/';
const TITLE = /^# (?<title>.+)$/mu;

function titleOf(text: string): string {
    return TITLE.exec(text)?.groups?.['title'] ?? '';
}

// An entry is a file path under the rules folder, or a folder that holds a layer or a configuration's files.
function isExcluded(source: string, exclude: string[]): boolean {
    return exclude.some((entry) => source === entry || source.startsWith(`${entry.replace(/\/$/u, '')}/`));
}

function agentLayerFiles(): { source: string; layer: string; configuration: string }[] {
    return [...AGENT_LAYERS].flatMap((layer) =>
        listAssets(`${RULES_PREFIX}${layer}/`).map((path) => ({
            source: path.slice(RULES_PREFIX.length),
            layer: layer.slice(layer.indexOf('/') + 1),
            configuration: 'rules',
        })),
    );
}

function manifestFiles(manifests: Manifest[]): { source: string; layer: string; configuration: string }[] {
    return manifests.flatMap((manifest) =>
        Object.entries(manifest.rule_files).flatMap(([layer, paths]) =>
            paths.map((source) => ({ source, layer, configuration: manifest.configuration.name })),
        ),
    );
}

/** The files the managed block tells the reader to open first; they cannot be left out. */
export const FIRST_READ = ['general/agent/WORKING.md', 'general/prose/WRITING.md'];

/**
 * The rule files the selection installs, in layer order, deduplicated.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @returns the rule files with their targets and titles
 */
export function selectRuleFiles(rules: Policy['rules'], manifests: Manifest[]): RuleFile[] {
    const available = new Set(listAssets(RULES_PREFIX));
    const { exclude } = rules;
    const files = new Map<string, RuleFile>();
    for (const { source, layer, configuration } of [...agentLayerFiles(), ...manifestFiles(manifests)]) {
        const path = `${RULES_PREFIX}${source}`;
        if (!available.has(path) || files.has(source) || isExcluded(source, exclude)) continue;
        files.set(source, {
            source,
            target: `${rules.directory}/${source}`,
            layer,
            configuration,
            title: titleOf(readAsset(path)),
        });
    }
    return files.values().toArray();
}

/**
 * The rule files as generated files. Content is the rule text unchanged.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @returns the files to write under the rules directory
 */
export function assembleRules(rules: Policy['rules'], manifests: Manifest[]): GeneratedFile[] {
    if (!rules.install) return [];
    return selectRuleFiles(rules, manifests).map((file) => ({
        path: file.target,
        content: readAsset(`${RULES_PREFIX}${file.source}`),
        readOnly: true,
        kind: 'rules',
        configuration: file.configuration,
    }));
}

/**
 * The problems of [rules] exclude: an entry that matches no rule file, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written
 * @returns the problems in plain English
 */
export function excludeProblems(exclude: string[]): string[] {
    const sources = listAssets(RULES_PREFIX).map((path) => path.slice(RULES_PREFIX.length));
    return exclude.flatMap((entry) => {
        if (FIRST_READ.some((file) => isExcluded(file, [entry])))
            return [
                `[rules] exclude names \`${entry}\`, which holds a file every agent opens first (${FIRST_READ.join(', ')}). Remove the entry.`,
            ];
        if (sources.some((source) => isExcluded(source, [entry]))) return [];
        const near = nearMatches(entry, sources);
        const names = near.map((name) => `\`${name}\``).join(', ');
        const hint = near.length > 0 ? ` Did you mean ${names}?` : '';
        return [`[rules] exclude names \`${entry}\`, which matches no rule file.${hint}`];
    });
}
