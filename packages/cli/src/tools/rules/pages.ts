import { RULE_PLACEHOLDER } from '#cli/config/manifests.ts';
import { ESLINT_MANIFEST_TOOL, STYLELINT_MANIFEST_TOOL } from '#cli/config/tools/rules.ts';
import { VALE_TOOL } from '#cli/config/tools/vale.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool, listDistinctTools } from '#cli/manifests/tools.ts';
import type { Tool } from '#cli/types/manifests.ts';

export function extractRulePrefix(rule: string): string | undefined {
    const prefixes = listDistinctTools(readConfigurations().values().toArray())
        .map((tool) => tool.rule_prefix)
        .filter((prefix): prefix is string => prefix !== undefined && rule.startsWith(`${prefix}/`));
    prefixes.sort((first, second) => second.length - first.length);
    return prefixes[0];
}

export function isUnlistedRule(tool: string, rule: string): boolean {
    if (tool === VALE_TOOL) return rule.startsWith('Vale.');
    if (tool === 'biome') return !rule.startsWith('lint/');
    if (tool !== ESLINT_MANIFEST_TOOL && tool !== STYLELINT_MANIFEST_TOOL) return false;
    return rule === 'CssSyntaxError' || (rule.includes('/') && extractRulePrefix(rule) === undefined);
}

export function findRulePlugin(prefix: string): Tool | undefined {
    return listDistinctTools(readConfigurations().values().toArray()).find((pin) => pin.rule_prefix === prefix);
}

export function findRulePage(tool: string, rule: string): string | undefined {
    const prefix = extractRulePrefix(rule);
    if (prefix === undefined) {
        const pin = getTool(readConfigurations().values(), tool);
        return pin.rule_url?.replace(RULE_PLACEHOLDER, () => rule);
    }
    const plugin = findRulePlugin(prefix);
    return plugin?.rule_url?.replace(RULE_PLACEHOLDER, () => rule.slice(prefix.length + 1));
}
