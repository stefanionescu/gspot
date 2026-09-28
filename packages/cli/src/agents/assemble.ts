// Select the rule files for the selection and render them under [rules] directory, keeping the layer folders.
import { nearMatches } from '#cli/policy/near.ts';
import type { Manifest } from '#cli/types/kits.ts';
import type { RuleFile } from '#cli/types/agents.ts';
import { detectConditions } from '#cli/kits/detect.ts';
import type { Policy } from '#cli/types/policy/policy.ts';
import { selectedSections } from '#cli/agents/sections.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import type { GeneratedFile } from '#cli/types/generation.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import { TITLE, FIRST_READ, AGENT_LAYERS, RULES_PREFIX } from '#cli/config/agents.ts';

function declaredGuides(
    manifests: Manifest[],
    repository: Repository,
): Pick<RuleFile, 'source' | 'layer' | 'configuration'>[] {
    const conditions = manifests.flatMap((manifest) =>
        Object.values(manifest.rule_files)
            .flat()
            .flatMap((entry) => (entry.when === undefined ? [] : [entry.when])),
    );
    const dependencies = manifests.some((manifest) =>
        Object.values(manifest.rule_files)
            .flat()
            .some((entry) => entry.when !== undefined && entry.when.dependencies.length > 0),
    );
    const facts = dependencies ? readManifests(repository.root, repository.files) : [];
    const matched = detectConditions(conditions, repository.files, facts);
    return manifests.flatMap((manifest) =>
        Object.entries(manifest.rule_files).flatMap(([layer, paths]) =>
            paths
                .filter((entry) => entry.when === undefined || matched.has(entry.when))
                .map(({ path: source }) => ({ source, layer, configuration: manifest.configuration.name })),
        ),
    );
}

/**
 * The rule files the selection installs, in layer order, deduplicated.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @param repository the source inventory for conditional guide selection.
 * @returns the rule files with their targets and titles
 */
export function selectRuleFiles(rules: Policy['rules'], manifests: Manifest[], repository: Repository): RuleFile[] {
    const available = new Set(listAssets(RULES_PREFIX));
    const { exclude } = rules;
    const files = new Map<string, RuleFile>();
    for (const { source, layer, configuration } of [
        ...[...AGENT_LAYERS].flatMap((layer) =>
            listAssets(`${RULES_PREFIX}${layer}/`).map((path) => ({
                source: path.slice(RULES_PREFIX.length),
                layer: layer.slice(layer.indexOf('/') + 1),
                configuration: 'rules',
            })),
        ),
        ...declaredGuides(manifests, repository),
    ]) {
        const path = `${RULES_PREFIX}${source}`;
        if (!available.has(path)) throw new Error(`The selected rule guide does not exist: ${source}`);
        if (
            files.has(source) ||
            exclude.some((entry) => source === entry || source.startsWith(`${entry.replace(/\/$/u, '')}/`))
        )
            continue;
        files.set(source, {
            source,
            target: `${rules.directory}/${source}`,
            layer,
            configuration,
            title: TITLE.exec(readAsset(path))?.groups?.['title'] ?? '',
        });
    }
    return files.values().toArray();
}

/**
 * The selected rule files with sections filtered to the enforcement level.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @param level the selected enforcement level.
 * @param repository the source inventory for conditional guide selection.
 * @returns the files to write under the rules directory
 */
export function assembleRules(
    rules: Policy['rules'],
    manifests: Manifest[],
    level: Policy['level'],
    repository: Repository,
): GeneratedFile[] {
    if (!rules.install) return [];
    return selectRuleFiles(rules, manifests, repository).map((file) => ({
        path: file.target,
        content: selectedSections(readAsset(`${RULES_PREFIX}${file.source}`), level),
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
        if (
            FIRST_READ.some((file) =>
                [entry].some((entry) => file === entry || file.startsWith(`${entry.replace(/\/$/u, '')}/`)),
            )
        )
            return [
                `[rules] exclude names \`${entry}\`, which holds a file every agent opens first (${FIRST_READ.join(', ')}). Remove the entry.`,
            ];
        if (
            sources.some((source) =>
                [entry].some((entry) => source === entry || source.startsWith(`${entry.replace(/\/$/u, '')}/`)),
            )
        )
            return [];
        const near = nearMatches(entry, sources);
        const names = near.map((name) => `\`${name}\``).join(', ');
        const hint = near.length > 0 ? ` Did you mean ${names}?` : '';
        return [`[rules] exclude names \`${entry}\`, which matches no rule file.${hint}`];
    });
}
