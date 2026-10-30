import { posix } from 'node:path';
import { readFileSync } from 'node:fs';
import { visit } from 'unist-util-visit';
import { compareText } from '#cli/system/text.ts';
import type { Session } from '#cli/types/session.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { SourcePosition } from '#cli/types/text.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { stripTrailingSlashes } from '#cli/system/paths.ts';
import { detectConditions } from '#cli/repository/detect.ts';
import type { Scope } from '#cli/types/settings/inheritance.ts';
import { listRuleFiles } from '#cli/configurations/manifests.ts';
import { type Repository } from '#cli/types/repository/files.ts';
import { GROUPS, GROUP_LABELS } from '#cli/config/configurations/names.ts';
import { listSelectedConfigurations } from '#cli/configurations/select.ts';
import { type Level, type Configuration } from '#cli/types/configurations.ts';
import type { RuleFile, RuleSection, ShippedRule, AgentsBlockContent } from '#cli/types/generation/rules.ts';

import {
    FIRST_READ,
    BLANK_LINE,
    RULES_HEADING,
    EDIT_KEYS_LINE,
    FIRST_READ_LINE,
    COMMANDS_HEADING,
    RULE_INDEX_LINES,
    ALL_LEVEL_MARKER,
    MARKDOWN_HEADING,
    SETTINGS_COMMANDS,
    RULE_OPENING_PREFIX,
    GENERATED_FILES_LINE,
    GENERATED_FILES_HEADING,
} from '#cli/config/generation/rules.ts';

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

function buildLevelRuleText(text: string, level: Level): string {
    let through = 0;
    const output: string[] = [];
    for (const { start, end, marker } of parseHeadingSections(text)) {
        if (marker === undefined || start < through) continue;
        const markerEnd =
            text.startsWith(BLANK_LINE, marker.end) && text.endsWith(BLANK_LINE, marker.start) ? BLANK_LINE.length : 1;
        const cut = level === 'all' ? { start: marker.start, end: marker.end + markerEnd } : { start, end };
        output.push(text.slice(through, cut.start));
        through = cut.end;
    }
    output.push(text.slice(through));
    return output.join('').trimEnd() + '\n';
}

function groupIndexLines(files: RuleFile[]): [string, string[]][] {
    const rows = new Map<string, string[]>();
    for (const file of files) {
        if (FIRST_READ.includes(file.path)) continue;
        const label = GROUP_LABELS[file.group];
        const list = rows.get(label) ?? [];
        const scopes = file.scopes.map((path) => `\`${path}/\``).join(', ');
        const scope = file.scopes.includes('') ? '' : ` in ${scopes}`;
        const opening = (file.content.split(BLANK_LINE) as [string, string, ...string[]])[1];
        const sentence = opening.replaceAll('\n', ' ').replace(RULE_OPENING_PREFIX, '');
        list.push(`\`${file.target}\`${scope}: ${sentence}`);
        rows.set(label, list);
    }
    return GROUPS.flatMap((group) => {
        const label = GROUP_LABELS[group];
        const lines = rows.get(label);
        return lines === undefined ? [] : [[label, lines.toSorted(compareText)] as [string, string[]]];
    });
}

function formatRulesIndex(files: RuleFile[]): string[] {
    return [
        FIRST_READ_LINE,
        '',
        ...FIRST_READ.map((path) => `- \`${GSPOT_PATHS.configurations}/${path}\``),
        '',
        ...RULE_INDEX_LINES,
        '',
        ...groupIndexLines(files).flatMap(([label, paths]) => [
            `## ${label}`,
            '',
            ...paths.map((path) => `- ${path}`),
            '',
        ]),
    ];
}

function formatSettingsCommands(startCommand: string): string {
    const commands = SETTINGS_COMMANDS.map((command, index) => (index === 0 ? `${startCommand} ${command}` : command));
    return new Intl.ListFormat('en', { type: 'disjunction' }).format(commands.map((command) => '`' + command + '`'));
}

function parseHeadingSections(text: string): RuleSection[] {
    const nodes = fromMarkdown(text).children;
    const headings: Omit<RuleSection, 'end'>[] = [];
    for (const [index, node] of nodes.entries()) {
        if (node.type !== 'heading') continue;
        const start = (node.position as SourcePosition).start.offset;
        const next = nodes[index + 1];
        const marker =
            next?.type === 'html' && next.value.trim() === ALL_LEVEL_MARKER
                ? {
                      start: (next.position as SourcePosition).start.offset,
                      end: (next.position as SourcePosition).end.offset,
                  }
                : undefined;
        headings.push({ start, depth: node.depth, marker });
    }
    return headings.map((heading, index) => ({
        ...heading,
        end: headings.slice(index + 1).find((next) => next.depth <= heading.depth)?.start ?? text.length,
    }));
}

function listScopeRules(scope: Scope): Set<string> {
    return new Set(
        scope.configurations.flatMap((configuration) => listRuleFiles(configuration).map((file) => file.path)),
    );
}

/**
Select the shared rules and the configuration rules at the level. Leave out the excluded rules
and the ones that the level leaves empty.

@param session the repository and its settings.
*/
export function selectRuleFiles(session: Pick<Session, 'settings' | 'scopes' | 'repository'>): RuleFile[] {
    const { repository } = session;
    const { rules, level } = session.settings;
    if (!rules.enabled) return [];
    const configurations = listSelectedConfigurations(session.scopes);
    const scopeRules = session.scopes.map((scope) => ({
        path: scope.path,
        rules: listScopeRules(scope),
    }));
    const selected: RuleFile[] = [];
    const shipped = listConfigurationRules(configurations, repository).filter(({ path }) =>
        rules.exclude.every(
            (excluded) => !isInScope(`${GSPOT_PATHS.configurations}/${path}`, stripTrailingSlashes(excluded)),
        ),
    );
    for (const { source, path, group } of shipped) {
        const text = readFileSync(buildAssetPath(source), 'utf8');
        const content = buildLevelRuleText(text, level);
        if (content !== text && parseHeadingSections(content).every((section) => section.depth <= 1)) continue;
        const scopes = scopeRules.filter((scope) => scope.rules.has(path)).map((scope) => scope.path);
        selected.push({ path, target: `${GSPOT_PATHS.configurations}/${path}`, content, group, scopes });
    }
    return selected;
}

/**
Build the managed block for the rules.

@param block what the block lists.
@param block.files the rules with their content.
@param block.managedKeys the keys that gspot manages inside authored config files.
@param block.hasOwnTitle whether the file has its own top heading, which moves the block headings down.
@param block.startCommand the command that starts gspot.
*/
export function buildAgentsBlock({ files, managedKeys, startCommand, hasOwnTitle }: AgentsBlockContent): string {
    const index = files.length > 0 ? formatRulesIndex(files) : [];
    const lines = [
        RULES_HEADING,
        '',
        ...index,
        COMMANDS_HEADING,
        '',
        `The rules write \`gspot\` for \`${startCommand}\`.`,
        '',
        `After you add code in a new language, framework or tool, run \`${startCommand} add\`, then \`${startCommand} install\`.`,
        '',
        `To change \`gspot.toml\`, run ${formatSettingsCommands(startCommand)}.`,
        `After you edit \`gspot.toml\` by hand, run \`${startCommand} apply\`.`,
        '',
        GENERATED_FILES_HEADING,
        '',
        GENERATED_FILES_LINE,
        `Do not edit these files. Change \`gspot.toml\`, then run \`${startCommand} apply\`.`,
        ...managedKeys.flatMap(({ path, keys }) => [
            '',
            `gspot also sets ${keys.length === 1 ? 'one key' : 'these keys'} in \`${path}\`: ${keys.map((key) => '`' + key + '`').join(' and ')}.`,
            EDIT_KEYS_LINE,
        ]),
    ];
    return (hasOwnTitle ? lines.map((line) => line.replace(MARKDOWN_HEADING, '#$1 ')) : lines).join('\n');
}

/**
Check whether Markdown text has a top heading, outside code blocks.

@param text the text of AGENTS.md outside the gspot block.
*/
export function hasTopHeading(text: string): boolean {
    let isFound = false;
    visit(fromMarkdown(text), 'heading', (node) => {
        if (node.depth === 1) isFound = true;
    });
    return isFound;
}
