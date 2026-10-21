// Select the rules and build their managed block.
import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { visit } from 'unist-util-visit';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { SourcePosition } from '#cli/types/text.ts';
import { trimTrailingSlashes } from '#cli/system/paths.ts';
import { GROUP_LABELS } from '#cli/config/configurations.ts';
import { detectConditions } from '#cli/repository/detect.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { SETTINGS_COMMANDS } from '#cli/config/settings/file.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import { type Repository } from '#cli/types/repository/inventory.ts';
import { GSPOT_CONFIGURATIONS_PATH } from '#cli/config/gspot-paths.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { type Level, type Configuration } from '#cli/types/configurations.ts';
import type { RuleFile, RuleSection, ShippedRule, AgentsBlockContent } from '#cli/types/generation/rules.ts';

import {
    FIRST_READ,
    RULES_HEADING,
    ALL_LEVEL_MARKER,
    MARKDOWN_HEADING,
    RULE_OPENING_PREFIX,
} from '#cli/config/generation/rules.ts';

// List the rules of the configurations; a file with a condition installs only when the repository meets it.
function listConfigurationRules(configurations: Configuration[], repository: Repository): ShippedRule[] {
    const conditions = configurations.flatMap((configuration) => Object.values(configuration.rules));
    const matched = detectConditions(conditions, repository.files, repository.dependencyFiles);
    return configurations.flatMap((configuration) =>
        listRuleFiles(configuration).filter((file) => {
            const condition = configuration.rules[posix.basename(file.source)];
            return condition === undefined || matched.has(condition);
        }),
    );
}

/**
 * Drop the marked Markdown sections and their subsections at level recommended.
 *
 * @param text the authored rule with Markdown level markers.
 * @param level recommended or all.
 *
 * @returns the original bytes outside the dropped sections.
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

function groupIndexLines(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        if (FIRST_READ.includes(file.path)) continue;
        const label = GROUP_LABELS[file.group];
        const list = rows.get(label) ?? [];
        const scopes = file.scopes.map((path) => `\`${path}/\``).join(', ');
        const scope = file.scopes.includes('') ? '' : ` in ${scopes}`;
        const opening = (file.content.split('\n') as [string, string, string, ...string[]])[2];
        const sentence = opening.replace(RULE_OPENING_PREFIX, '');
        list.push(`\`${file.target}\`${scope}: ${sentence}`);
        rows.set(label, list);
    }
    return [...rows];
}

function formatRulesIndex(files: RuleFile[]): string[] {
    return [
        'Read these rules first:',
        '',
        ...FIRST_READ.map((path) => `- \`${GSPOT_CONFIGURATIONS_PATH}/${path}\``),
        '',
        'Read a rule below when its sentence fits your task.',
        'A rule marked `in <folder>/` applies only to files in that folder.',
        'A more specific rule wins over a general one.',
        '',
        ...groupIndexLines(files).flatMap(([label, paths]) => [
            `## ${label}`,
            '',
            ...paths.map((path) => `- ${path}`),
            '',
        ]),
    ];
}

// The first command carries the start command; the others read as its subcommands.
function formatSettingsCommands(startCommand: string): string {
    const commands = SETTINGS_COMMANDS.map((command, index) => (index === 0 ? `${startCommand} ${command}` : command));
    return new Intl.ListFormat('en', { type: 'disjunction' }).format(commands.map((command) => '`' + command + '`'));
}

/**
 * Find heading sections and their level markers, and skip headings inside code fences.
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

// List the rule files of each scope before selecting shared content.
function listScopeRules(scope: Scope): Set<string> {
    return new Set(
        scope.configurations.flatMap((configuration) => listRuleFiles(configuration).map((file) => file.path)),
    );
}

/**
 * Select the shared rules and the configuration rules at the level. Leave out the excluded rules
 * and the ones that the level leaves empty.
 *
 * @param session the repository and its settings.
 * @returns each rule with its content and path.
 */
export function selectRuleFiles(session: Pick<Session, 'settingsFile' | 'scopes' | 'repository'>): RuleFile[] {
    const {
        settingsFile: {
            settings: { rules, level },
        },
        repository,
    } = session;
    if (!rules.enabled) return [];
    const configurations = listSelectedConfigurations(session.scopes);
    const scopeRules = session.scopes.map((scope) => ({
        path: scope.folder.path,
        rules: listScopeRules(scope),
    }));
    const sources = new Map(listConfigurationRules(configurations, repository).map((file) => [file.path, file]));
    return sources
        .values()
        .filter(
            ({ path }) =>
                !rules.exclude.some((entry) =>
                    isInScope(`${GSPOT_CONFIGURATIONS_PATH}/${path}`, trimTrailingSlashes(entry)),
                ),
        )
        .flatMap(({ source, path, group }) => {
            const text = readFileSync(buildAssetPath(source), 'utf8');
            const content = stripAllLevelSections(text, level);
            if (content !== text && !parseHeadingSections(content).some((section) => section.depth > 1)) return [];
            const scopes = scopeRules.filter((scope) => scope.rules.has(path)).map((scope) => scope.path);
            return [{ path, target: `${GSPOT_CONFIGURATIONS_PATH}/${path}`, content, group, scopes }];
        })
        .toArray();
}

/**
 * Build the managed block for the rules.
 *
 * @param block what the block lists.
 * @param block.files the rules with their content.
 * @param block.generatedPaths the files gspot writes outside .gspot, with managed keys.
 * @param block.managedKeys the keys that gspot manages inside authored tool files.
 * @param block.hasChecks whether any configuration runs a check.
 * @param block.hasOwnTitle whether the file has its own top heading, which moves the block headings down.
 * @param block.startCommand the command that starts gspot.
 *
 * @returns the heading, rule index, and instructions for changing settings.
 */
export function buildAgentsBlock({
    files,
    generatedPaths,
    managedKeys,
    hasChecks,
    startCommand,
    hasOwnTitle,
}: AgentsBlockContent): string {
    const index = files.length > 0 ? formatRulesIndex(files) : [];
    const outside = generatedPaths
        .toSorted((first, second) => first.localeCompare(second))
        .map((path) => `- \`${path}\``);
    const lines = [
        RULES_HEADING,
        '',
        ...index,
        '## Commands',
        '',
        `The rules write \`gspot\` for \`${startCommand}\`.`,
        '',
        ...(hasChecks ? [`Before you commit, run \`${startCommand} check --staged\`.`, ''] : []),
        `To change \`gspot.toml\`, run ${formatSettingsCommands(startCommand)}.`,
        `After you edit \`gspot.toml\` by hand, run \`${startCommand} apply\`.`,
        '',
        '## Generated files',
        '',
        `Do not edit these files. Change \`gspot.toml\`, then run \`${startCommand} apply\`.`,
        '',
        '- every file under `.gspot/`',
        ...outside,
        ...managedKeys.flatMap(({ path, keys }) => [
            '',
            `gspot also sets ${keys.length === 1 ? 'one key' : 'these keys'} in \`${path}\`: ${keys.map((key) => '`' + key + '`').join(' and ')}.`,
            'You can edit the other keys of that file.',
        ]),
    ];
    // A file with its own title keeps one top heading, which markdownlint asks for.
    return (hasOwnTitle ? lines.map((line) => line.replace(MARKDOWN_HEADING, '#$1 ')) : lines).join('\n');
}

/**
 * Check whether Markdown text has a top heading, outside code blocks.
 *
 * @param text the authored part of the file.
 * @returns whether a level-one heading exists.
 */
export function hasTopHeading(text: string): boolean {
    let found = false;
    visit(fromMarkdown(text), 'heading', (node) => {
        if (node.depth === 1) found = true;
    });
    return found;
}
