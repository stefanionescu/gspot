// Select agent instructions from configuration assets and emit them into the configured rules folder.
import { posix } from 'node:path';
import { isExcluded } from '#cli/policy/public.ts';
import { ruleSections } from '#cli/parsers/public.ts';
import { readAsset } from '#cli/platform/root/public.ts';
import { FRONT_MATTER } from '#cli/config/agent-rules.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import type { PackageManifest } from '#cli/types/parsers/packages.ts';
import type { RuleFile, AgentRules } from '#cli/types/agent-rules.ts';
import { detectConditions } from '#cli/repository/selection/contracts.ts';
import { CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';
import type { Level, Manifest, RuleSource } from '#cli/types/configurations.ts';
import { configurationFiles, configurationManifests } from '#cli/configurations/public.ts';

// The rules of the selected configurations; a file with a condition installs only when the repository meets it.
function configurationRules(
    manifests: Manifest[],
    repository: Repository,
    packageManifests: PackageManifest[],
): RuleSource[] {
    const conditions = manifests.flatMap((manifest) => Object.values(manifest.agent_rules));
    const matched = detectConditions(conditions, repository.files, packageManifests);
    return manifests.flatMap((manifest) =>
        configurationFiles(manifest).filter((file) => {
            const condition =
                manifest.agent_rules[posix.relative(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}`, file.source)];
            return condition === undefined || matched.has(condition);
        }),
    );
}

/**
 * The shared engineering instructions and selected configuration rules at the level, without the
 * excluded ones and the ones the level leaves empty.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @param repository the source inventory for the conditional rules.
 * @param level the selected enforcement level
 * @param packageManifests the parsed source package manifests
 * @returns each rule with its final content and destination
 */
export function selectRuleFiles(
    rules: AgentRules,
    manifests: Manifest[],
    repository: Repository,
    level: Level,
    packageManifests: PackageManifest[],
): RuleFile[] {
    if (!rules.enabled) return [];
    const shared = [...configurationManifests().values()].filter((manifest) => manifest.configuration.always_selected);
    const sources = new Map(
        configurationRules([...shared, ...manifests], repository, packageManifests).map((file) => [file.path, file]),
    );
    return sources
        .values()
        .filter(({ path }) => !rules.exclude.some((entry) => isExcluded(entry, path)))
        .flatMap(({ source, path }) => {
            const text = readAsset(source);
            const content = textAtLevel(text, level);
            // Front matter parses as a heading, but it is not a rule section.
            const body = content.replace(FRONT_MATTER, '');
            if (content !== text && !ruleSections(body).some((section) => section.depth > 1)) return [];
            return [{ path, target: `${rules.folder}/${path}`, content }];
        })
        .toArray();
}

/**
 * Omits marked Markdown sections, including their subsections, at the recommended level.
 * @param text the authored rule with Markdown level markers.
 * @param level the selected enforcement level.
 * @returns the original bytes outside excluded sections.
 */
export function textAtLevel(text: string, level: Level): string {
    if (level === 'all') return text;
    let through = 0;
    const output: string[] = [];
    for (const section of ruleSections(text).filter((entry) => entry.all)) {
        if (section.start < through) continue;
        output.push(text.slice(through, section.start));
        through = section.end;
    }
    output.push(text.slice(through));
    return output.join('');
}
