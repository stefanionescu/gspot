// Selects agent rules and builds their managed instruction block.
import { posix } from 'node:path';
import { readAsset } from '#cli/system/assets.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { SourcePosition } from '#cli/types/text.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import { detectConditions } from '#cli/repository/detect.ts';
import { isExcluded } from '#cli/settings/validation/values.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import type { ParsedRules } from '#cli/types/settings/tables.ts';
import { RULES_DIRECTORY } from '#cli/config/system/locations.ts';
import { type Repository } from '#cli/types/repository/inventory.ts';
import { type Level, type Manifest } from '#cli/types/configurations.ts';
import { type DependencyFile } from '#cli/types/parsers/dependency-files.ts';
import type { RuleFile, RuleSource, RuleSection, ManagedBlockValues } from '#cli/types/rules.ts';
import { FIRST_READ, RULES_HEADING, CHECKS_CLOSING, ALL_LEVEL_MARKER, RULES_ONLY_CLOSING } from '#cli/config/rules.ts';

// The rules of the selected configurations; a file with a condition installs only when the repository meets it.
function listConfigurationRules(
    manifests: Manifest[],
    repository: Repository,
    dependencyFiles: DependencyFile[],
): RuleSource[] {
    const conditions = manifests.flatMap((manifest) => Object.values(manifest.rules));
    const matched = detectConditions(conditions, repository.files, dependencyFiles);
    return manifests.flatMap((manifest) =>
        listRuleFiles(manifest).filter((file) => {
            const condition = manifest.rules[posix.basename(file.source)];
            return condition === undefined || matched.has(condition);
        }),
    );
}

/**
 * Omits marked Markdown sections, including their subsections, at the recommended level.
 *
 * @param text the authored rule with Markdown level markers.
 * @param level the selected enforcement level.
 *
 * @returns the original bytes outside excluded sections.
 */
function stripAllLevelSections(text: string, level: Level): string {
    if (level === 'all') return text;
    let through = 0;
    const output: string[] = [];
    for (const section of parseHeadingSections(text).filter((entry) => entry.all)) {
        if (section.start < through) continue;
        output.push(text.slice(through, section.start));
        through = section.end;
    }
    output.push(text.slice(through));
    return output.join('');
}

function groupFilesByArea(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        if (FIRST_READ.has(file.path)) continue;
        const area = GROUP_LABELS[file.group];
        const list = rows.get(area) ?? [];
        list.push(`\`${file.target}\``);
        rows.set(area, list);
    }
    return [...rows];
}

function formatRulesIndex(files: RuleFile[]): string[] {
    return [
        `Read ${[...FIRST_READ].map((path) => '`' + RULES_DIRECTORY + '/' + path + '`').join(' and ')} first. Then read the rules for the files you change. A more specific rule wins over a general one.`,
        '',
        ...groupFilesByArea(files).flatMap(([area, paths]) => [
            `${area}:`,
            '',
            ...paths.map((path) => `- ${path}`),
            '',
        ]),
    ];
}

/**
 * Locate heading sections and their level markers without treating fenced headings as structure.
 *
 * @param text the authored Markdown rule.
 *
 * @returns source ranges, depths, and level markers for each heading.
 */
function parseHeadingSections(text: string): RuleSection[] {
    const nodes = fromMarkdown(text).children;
    const headings = nodes.flatMap((node, index) => {
        if (node.type !== 'heading') return [];
        const start = (node.position as SourcePosition).start.offset;
        const marker = nodes[index + 1];
        return [{ start, depth: node.depth, all: marker?.type === 'html' && marker.value.trim() === ALL_LEVEL_MARKER }];
    });
    return headings.map((heading, index) => ({
        ...heading,
        end: headings.slice(index + 1).find((next) => next.depth <= heading.depth)?.start ?? text.length,
    }));
}

/**
 * The shared engineering instructions and selected configuration rules at the level, without the
 * excluded ones and the ones the level leaves empty.
 *
 * @param rules the settings for selecting and excluding rule files.
 * @param manifests the selected configurations.
 * @param repository the source inventory for the conditional rules.
 * @param level the selected enforcement level.
 * @param dependencyFiles the parsed source package manifests.
 *
 * @returns each rule with its final content and destination.
 */
export function selectRuleFiles(
    rules: ParsedRules,
    manifests: Manifest[],
    repository: Repository,
    level: Level,
    dependencyFiles: DependencyFile[],
): RuleFile[] {
    if (!rules.enabled) return [];
    const sources = new Map(
        listConfigurationRules(manifests, repository, dependencyFiles).map((file) => [file.path, file]),
    );
    return sources
        .values()
        .filter(({ path }) => !rules.exclude.some((entry) => isExcluded(entry, `${RULES_DIRECTORY}/${path}`)))
        .flatMap(({ source, path, group }) => {
            const text = readAsset(source);
            const content = stripAllLevelSections(text, level);
            if (content !== text && !parseHeadingSections(content).some((section) => section.depth > 1)) return [];
            return [{ path, target: `${RULES_DIRECTORY}/${path}`, content, group }];
        })
        .toArray();
}

/**
 * The managed instruction block for the already selected rules and enforcement level.
 *
 * @param inputs the selected rules, enforcement level, start command, and presence of executable checks.
 * @param inputs.files the selected files with final content.
 * @param inputs.generatedPaths the generated destinations outside .gspot, including managed configuration keys.
 * @param inputs.level the enforcement level.
 * @param inputs.hasChecks whether the selected configurations provide executable checks.
 * @param inputs.startCommand the pinned repository start command.
 *
 * @returns the heading, rule index, and instructions for changing settings.
 */
export function buildAgentsBlock({
    files,
    generatedPaths,
    level,
    hasChecks,
    startCommand,
}: ManagedBlockValues): string {
    const index = files.length > 0 ? formatRulesIndex(files) : [];
    const outside = [...new Set(generatedPaths)]
        .toSorted((first, second) => first.localeCompare(second))
        .map((path) => `\`${path}\``);
    const closing = (hasChecks ? CHECKS_CLOSING : RULES_ONLY_CLOSING)
        .replaceAll('{start}', startCommand)
        .replace('{outside}', outside.length === 0 ? '' : `, or these generated files: ${outside.join(', ')}`);
    return [RULES_HEADING, '', `Level: \`${level}\`.`, '', ...index, closing].join('\n');
}
