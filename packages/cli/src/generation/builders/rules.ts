import { readFileSync } from 'node:fs';

import { fromMarkdown } from 'mdast-util-from-markdown';

import { ALL_LEVEL_MARKER, BLANK_LINE } from '#cli/config/generation/files.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { SETTING_PLACEHOLDER } from '#cli/config/repository/files.ts';
import { listRuleFiles } from '#cli/manifests/read.ts';
import { detectConditions } from '#cli/repository/detection/configurations.ts';
import { getRootScope, listSelectedConfigurations } from '#cli/settings/scopes.ts';
import { isRuleFileExcluded } from '#cli/settings/values/paths.ts';
import { buildAssetPath } from '#cli/system/package/assets.ts';
import type { RuleFile, RuleSection } from '#cli/types/generation.ts';
import type { Configuration, ShippedRule } from '#cli/types/manifests.ts';
import type { SourcePosition } from '#cli/types/parsers.ts';
import type { Repository } from '#cli/types/repository.ts';
import type { Level, Scope } from '#cli/types/settings.ts';
import type { Session } from '#cli/types/tools.ts';

function listConfigurationRules(configurations: Configuration[], repository: Repository): ShippedRule[] {
    const conditions = configurations.flatMap((configuration) => Object.values(configuration.rules));
    const matched = detectConditions(conditions, repository.files, repository.dependencyFiles);
    return configurations.flatMap((configuration) =>
        listRuleFiles(configuration).filter((file) => {
            const condition = configuration.rules[file.path];
            return condition === undefined || matched.has(condition);
        }),
    );
}

function buildLevelCut(
    text: string,
    section: Pick<RuleSection, 'start' | 'end'>,
    marker: NonNullable<RuleSection['marker']>,
    level: Level,
): Pick<RuleSection, 'start' | 'end'> {
    if (level !== 'all') return section;
    const isBlankAround = text.startsWith(BLANK_LINE, marker.end) && text.endsWith(BLANK_LINE, marker.start);
    return { start: marker.start, end: marker.end + (isBlankAround ? BLANK_LINE.length : 1) };
}

function buildLevelRuleText(text: string, level: Level): string {
    let through = 0;
    const output: string[] = [];
    for (const { start, end, marker } of parseHeadingSections(text)) {
        if (marker === undefined || start < through) continue;
        const cut = buildLevelCut(text, { start, end }, marker, level);
        output.push(text.slice(through, cut.start));
        through = cut.end;
    }
    output.push(text.slice(through));
    return `${output.join('').trimEnd()}\n`;
}

function parseHeadingSections(text: string): RuleSection[] {
    const nodes = fromMarkdown(text).children;
    const headings: Array<Omit<RuleSection, 'end'>> = [];
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

export function selectRuleFiles(session: Pick<Session, 'settings' | 'scopes' | 'repository'>): RuleFile[] {
    const { repository } = session;
    const { rule_files: ruleFiles, level } = session.settings;
    if (!ruleFiles.enabled) return [];
    const configurations = listSelectedConfigurations(session.scopes);
    const root = getRootScope(session.scopes);
    const scopeRules = session.scopes.map((scope) => ({
        path: scope.path,
        rules: listScopeRules(scope),
    }));
    const selected: RuleFile[] = [];
    const shipped = listConfigurationRules(configurations, repository).filter(({ path }) =>
        ruleFiles.exclude.every((excluded) => !isRuleFileExcluded(path, excluded)),
    );
    for (const { source, path } of shipped) {
        const text = readFileSync(buildAssetPath(source), 'utf8');
        const content = buildLevelRuleText(text, level);
        if (content !== text && parseHeadingSections(content).every((section) => section.depth <= 1)) continue;
        const scopes = scopeRules.filter((scope) => scope.rules.has(path)).map((scope) => scope.path);
        selected.push({
            path,
            target: `${GSPOT_PATHS.rules}/${path}`,
            content: content.replaceAll(SETTING_PLACEHOLDER, (_token, name: string) =>
                String(root.settings.valuesByKey[name]),
            ),
            scopes,
        });
    }
    return selected;
}
