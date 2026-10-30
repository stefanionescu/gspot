import { JSON_INDENT } from '#cli/config/text.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import { refuseIdleRuleOptions } from '#cli/generation/config-files/rule-options.ts';
import type { OwnedConfigFile, PlannedConfigFile } from '#cli/types/generation/files.ts';

import {
    PRETTIER_STYLE,
    MARKDOWNLINT_CHECK,
    MARKDOWNLINT_RULES,
    MARKDOWNLINT_ALL_RULES,
    MARKDOWNLINT_PRETTIER_DISABLED,
} from '#cli/config/generation/configurations/language/markdown.ts';

/**
Build markdownlint.jsonc: the Markdown lint rules for the level, indentation, and your own rule options.

@param planned the config file to build.
*/
export function buildMarkdownlintFile(planned: Pick<PlannedConfigFile, 'scope' | 'level'>): string {
    const isAll = planned.level === 'all';
    const document: Record<string, string | boolean | Record<string, unknown>> = {
        extends: PRETTIER_STYLE,
        ...MARKDOWNLINT_RULES,
        MD041: isAll,
        MD025: isAll ? { front_matter_title: '' } : false,
    };
    const options = getTable(planned.scope.settings, 'tools.markdownlint').rules;
    const running = new Set(
        Object.keys(options).filter(
            (rule) => document[rule] !== false && !(MARKDOWNLINT_PRETTIER_DISABLED as readonly string[]).includes(rule),
        ),
    );
    refuseIdleRuleOptions({
        configured: Object.keys(options),
        running,
        allLevelRules: new Set(MARKDOWNLINT_ALL_RULES),
        level: planned.level,
    });
    for (const [rule, ruleOptions] of Object.entries(options))
        document[rule] = { ...(typeof document[rule] === 'object' && document[rule]), ...ruleOptions };
    Object.assign(
        document,
        Object.fromEntries(listIgnoredRules(planned.scope, MARKDOWNLINT_CHECK).map((rule) => [rule, false])),
    );
    return JSON.stringify(document, null, JSON_INDENT);
}

/**
Check whether a Markdown scope inherits the root config because both scopes generate the same text.

@param selected the scoped config file.
@param configFiles the config files and their owners.
*/
export function isMarkdownlintShared(selected: OwnedConfigFile, configFiles: OwnedConfigFile[]): boolean {
    const { configFile, owner } = selected;
    if (configFile.pointer?.inherit !== true || owner.scope.path === '') return false;
    const root = configFiles.find(
        (each) => each.configFile.target === configFile.target && each.owner.scope.path === '',
    );
    if (root === undefined) return false;
    const level = owner.session.settings.level;
    const texts = [selected, root].map((owned) => buildMarkdownlintFile({ scope: owned.owner.scope, level }));
    return texts[0] === texts[1];
}
