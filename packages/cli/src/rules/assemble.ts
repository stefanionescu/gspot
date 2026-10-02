// Select the guides for the selection and render them under [guides] directory, keeping the layer folders.
import { similar } from '#cli/platform/text.ts';
import { detectConditions } from '#cli/kits/detect.ts';
import { selectedSections } from '#cli/rules/sections.ts';
import { readManifests } from '#cli/repository/packages.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import type { Manifest, GeneratedFile } from '#cli/types/kits.ts';
import type { Repository } from '#cli/types/repository/repository.ts';
import type { Level, RuleFile, RuleSettings } from '#cli/types/rules.ts';
import { TITLE, FIRST_READ, AGENT_LAYERS, RULES_PREFIX } from '#cli/config/rules.ts';

function declaredGuides(manifests: Manifest[], repository: Repository): Pick<RuleFile, 'source' | 'layer' | 'kit'>[] {
    const conditions = manifests.flatMap((manifest) =>
        Object.values(manifest.guides)
            .flat()
            .flatMap((entry) => (entry.when === undefined ? [] : [entry.when])),
    );
    const dependencies = manifests.some((manifest) =>
        Object.values(manifest.guides)
            .flat()
            .some((entry) => entry.when !== undefined && entry.when.dependencies.length > 0),
    );
    const fields = dependencies ? readManifests(repository.root, repository.files) : [];
    const matched = detectConditions(conditions, repository.files, fields);
    return manifests.flatMap((manifest) =>
        Object.entries(manifest.guides).flatMap(([layer, paths]) =>
            paths
                .filter((entry) => entry.when === undefined || matched.has(entry.when))
                .map(({ path: source }) => ({ source, layer, kit: manifest.kit.name })),
        ),
    );
}

/**
 * The guides the selection installs, in layer order, deduplicated.
 * @param rules the rule policy
 * @param manifests the selected kits
 * @param repository the source inventory for conditional guide selection.
 * @returns the guides with their targets and titles
 */
export function selectRuleFiles(rules: RuleSettings, manifests: Manifest[], repository: Repository): RuleFile[] {
    const available = new Set(listAssets(RULES_PREFIX));
    const { exclude } = rules;
    const files = new Map<string, RuleFile>();
    for (const { source, layer, kit } of [
        ...[...AGENT_LAYERS].flatMap((layer) =>
            listAssets(`${RULES_PREFIX}${layer}/`).map((path) => ({
                source: path.slice(RULES_PREFIX.length),
                layer: layer.slice(layer.indexOf('/') + 1),
                kit: 'rules',
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
            kit,
            title: TITLE.exec(readAsset(path))?.groups?.['title'] ?? '',
        });
    }
    return files.values().toArray();
}

/**
 * The selected guides with sections filtered to the enforcement level.
 * @param rules the rule policy
 * @param manifests the selected kits
 * @param level the selected enforcement level.
 * @param repository the source inventory for conditional guide selection.
 * @returns the files to write under the rules directory
 */
export function assembleRules(
    rules: RuleSettings,
    manifests: Manifest[],
    level: Level,
    repository: Repository,
): GeneratedFile[] {
    if (!rules.install) return [];
    return selectRuleFiles(rules, manifests, repository).map((file) => ({
        path: file.target,
        content: selectedSections(readAsset(`${RULES_PREFIX}${file.source}`), level),
        readOnly: true,
        kind: 'rules',
        kit: file.kit,
    }));
}

/**
 * The problems of [guides] exclude: an entry that matches no guide, and an entry that hides a file the reader opens first.
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
                `[guides] exclude names \`${entry}\`, which holds a file every agent opens first (${FIRST_READ.join(', ')}). Remove the entry.`,
            ];
        if (
            sources.some((source) =>
                [entry].some((entry) => source === entry || source.startsWith(`${entry.replace(/\/$/u, '')}/`)),
            )
        )
            return [];
        const near = similar(entry, sources);
        const names = near.map((name) => `\`${name}\``).join(', ');
        const hint = near.length > 0 ? ` Did you mean ${names}?` : '';
        return [`[guides] exclude names \`${entry}\`, which matches no guide.${hint}`];
    });
}
