// Select agent instructions from configuration assets and render them into the configured rules folder.
import { posix } from 'node:path';
import { ruleSections } from '#cli/parsers/markdown.ts';
import { similar, codeList } from '#cli/platform/text.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { readManifests } from '#cli/repository/manifests.ts';
import { FIRST_READ, FRONT_MATTER } from '#cli/config/rules.ts';
import { readAsset, listAssets } from '#cli/platform/assets.ts';
import { detectConditions } from '#cli/configurations/detect.ts';
import type { Repository } from '#cli/types/repository/inventory.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { CONFIGURATION_RULES_FOLDER } from '#cli/config/configurations.ts';
import type { Level, RuleFile, RuleSource, RuleSettings, RuleExclusionProblem } from '#cli/types/rules.ts';

// Whether an exclude entry names the file or a folder above it, both relative to the rules folder.

function isExcluded(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry.replace(/\/$/u, '')}/`);
}

// The rules of the selected configurations; a file with a condition installs only when the repository meets it.
function configurationRules(manifests: Manifest[], repository: Repository): RuleSource[] {
    const conditions = manifests.flatMap((manifest) => Object.values(manifest.agent_rules));
    const isRead = conditions.some((condition) => condition.dependencies.length > 0 || condition.runtimes.length > 0);
    const matched = detectConditions(
        conditions,
        repository.files,
        isRead ? readManifests(repository.root, repository.files) : [],
    );
    return manifests.flatMap((manifest) =>
        configurationFiles(manifest).filter((file) => {
            const condition =
                manifest.agent_rules[posix.relative(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}`, file.source)];
            return condition === undefined || matched.has(condition);
        }),
    );
}

/**
 * The files of a configuration's rules folder. Each installs under the configuration's category and name, as language/bash/BASH.md.
 * @param manifest the configuration
 * @returns each file with its path inside the rules folder
 */
export function configurationFiles(manifest: Manifest): RuleSource[] {
    const { kind, name } = manifest.configuration;
    const sources = listAssets(`${manifest.dir}/${CONFIGURATION_RULES_FOLDER}/`);
    return sources.map((source) => ({
        source,
        path: `${kind}/${name}/${posix.relative(manifest.dir + '/' + CONFIGURATION_RULES_FOLDER, source)}`,
    }));
}

/**
 * The shared engineering instructions and selected configuration rules at the level, without the
 * excluded ones and the ones the level leaves empty.
 * @param rules the rule policy
 * @param manifests the selected configurations
 * @param repository the source inventory for the conditional rules.
 * @param level the selected enforcement level
 * @returns each rule with its final content and destination
 */
export function selectRuleFiles(
    rules: RuleSettings,
    manifests: Manifest[],
    repository: Repository,
    level: Level,
): RuleFile[] {
    if (!rules.enabled) return [];
    const shared = configurationManifests().get('engineering');
    if (shared === undefined) throw new Error('The installed configuration assets are missing engineering guidance.');
    const sources = new Map(configurationRules([shared, ...manifests], repository).map((file) => [file.path, file]));
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
 * The problems of [agent_rules] exclude: an entry that matches no rule, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written, relative to the rules folder
 * @returns each problem with its position in the exclusion list
 */
export function excludeProblems(exclude: string[]): RuleExclusionProblem[] {
    if (exclude.length === 0) return [];
    const paths = [...configurationManifests().values()].flatMap((manifest) =>
        configurationFiles(manifest).map((file) => file.path),
    );
    return exclude.flatMap((entry, index) => {
        if (FIRST_READ.some((file) => isExcluded(entry, file)))
            return [
                {
                    index,
                    message: `[agent_rules] exclude names ${codeList([entry])}, which holds a file every agent opens first (${codeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isExcluded(entry, path))) return [];
        const near = similar(entry, paths);
        const hint = near.length > 0 ? ` Did you mean ${codeList(near)}?` : '';
        return [{ index, message: `[agent_rules] exclude names ${codeList([entry])}, which matches no rule.${hint}` }];
    });
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
