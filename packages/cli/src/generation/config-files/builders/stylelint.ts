import { readFileSync } from 'node:fs';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { JSON_INDENT } from '#cli/config/generation/generate.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scope-settings.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';

import {
    TAILWIND_AT_RULES,
    STYLELINT_COMPONENTS,
    CSS_MODULES_OVERRIDE,
    STYLELINT_BASE_RULES,
    STYLELINT_RECOMMENDED_OFF,
    STYLELINT_RULE_NAMES_FILE,
} from '#cli/config/generation/config-files/builders/stylelint.ts';

function dropChosenRules(
    rules: Record<string, unknown>,
    chosen: Record<string, unknown>,
    off: string[],
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).filter(([rule]) => !off.includes(rule) && chosen[rule] === undefined),
    );
}

/**
 * Build the component parser overrides, which need their own pseudo-class and function rules.
 *
 * @param configurations the configuration names in use.
 * @param tailwindFunctions the Tailwind helpers that component styles may call.
 * @param chosen your own rule options.
 * @param off the disabled lint rule names.
 * @returns the component parser overrides.
 */
function buildComponentOverrides(
    configurations: string[],
    tailwindFunctions: string[],
    chosen: Record<string, unknown>,
    off: string[],
) {
    return configurations
        .flatMap((name) => STYLELINT_COMPONENTS[name] ?? [])
        .map((override) => {
            const { files, ignorePseudoClasses } = override;
            const functions = override.functions === undefined ? [] : [...override.functions, ...tailwindFunctions];
            const rules: Record<string, unknown> = {
                'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses }],
                ...(functions.length === 0
                    ? {}
                    : {
                          'function-no-unknown': [true, { ignoreFunctions: functions }],
                          'value-keyword-case': ['lower', { ignoreFunctions: override.functions }],
                          'declaration-property-value-no-unknown': [
                              true,
                              { ignoreProperties: { '/.*/': functions.map((name) => String.raw`/\b${name}\(/`) } },
                          ],
                      }),
            };
            return {
                files,
                customSyntax: override.customSyntax,
                rules: dropChosenRules(rules, chosen, off),
            };
        });
}

// A scope with CSS Modules files accepts their syntax in those files. The override keeps the Tailwind at-rules.
function buildCssModulesOverrides(
    planned: PlannedConfigFile,
    tailwindAtRules: readonly string[],
    chosen: Record<string, unknown>,
    off: string[],
) {
    const scope = planned.scope.folder.path;
    const hasModules = planned.session.repository.files.some(
        (file) => isInScope(file.path, scope) && file.path.endsWith(CSS_MODULES_OVERRIDE.suffix),
    );
    if (!hasModules) return [];
    const rules: Record<string, unknown> = {
        ...CSS_MODULES_OVERRIDE.rules,
        'at-rule-no-unknown': [true, { ignoreAtRules: [...tailwindAtRules, ...CSS_MODULES_OVERRIDE.atRules] }],
    };
    return [
        {
            files: [...CSS_MODULES_OVERRIDE.files],
            rules: dropChosenRules(rules, chosen, off),
        },
    ];
}

// gspot sets options only for the Stylelint rules that run at the level. The refusal names its case: a rule of level
// all, a Stylelint rule that runs at no level, or a rule that Stylelint does not have.
function assertStylelintRulesRun(rules: string[], activeRules: Set<string>, knownRules: string[]): void {
    const refused = rules.filter((rule) => !activeRules.has(rule));
    if (refused.length === 0) return;
    throw new GspotError(
        'settings',
        refused
            .map((rule) => {
                if (STYLELINT_RECOMMENDED_OFF.has(rule))
                    return `${rule} runs only at level all. gspot sets options only for the rules that run at level recommended.`;
                return knownRules.includes(rule)
                    ? `gspot runs ${rule} at no level, so it takes no options.`
                    : `${rule} belongs to no plugin that gspot loads.`;
            })
            .join('\n'),
    );
}

/**
 * Build stylelint.json: the CSS lint presets and rules for this level.
 *
 * @param planned the config file with its scope, level, and target path.
 * @returns the CSS lint presets and rules for this level.
 */
export function buildStylelintFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { dependencyFiles } = planned.session.repository;
    const level = planned.level;

    const { configurations } = scope.settings;
    const options = getTable(scope.settings, 'tools.stylelint');
    const isAll = level === 'all';
    const scopeDependencies = listProjectDependencyNames(dependencyFiles, scope.folder.path);
    const stylelintRuleNames = nameListSchema.parse(
        JSON.parse(readFileSync(buildAssetPath(STYLELINT_RULE_NAMES_FILE), 'utf8')),
    ).names;

    const off = listIgnoredRules(planned.scope, 'css/stylelint');
    const activeRules = new Set(
        [...stylelintRuleNames, 'function-no-unknown'].filter((rule) => isAll || !STYLELINT_RECOMMENDED_OFF.has(rule)),
    );
    assertStylelintRulesRun(Object.keys(options.rules), activeRules, stylelintRuleNames);
    const chosen = options.rules;
    const tailwind = scopeDependencies.includes('tailwindcss');
    const tailwindAtRules = tailwind ? TAILWIND_AT_RULES : [];
    const tailwindFunctions = tailwind ? ['theme'] : [];
    const overrides = [
        ...buildComponentOverrides(configurations, tailwindFunctions, chosen, off),
        ...buildCssModulesOverrides(planned, tailwindAtRules, chosen, off),
    ];
    const syntaxRules: Record<string, unknown> = {
        'at-rule-no-unknown': true,
        'function-no-unknown': true,
        'declaration-property-value-no-unknown': true,
    };
    if (tailwind) {
        syntaxRules['at-rule-no-unknown'] = [true, { ignoreAtRules: tailwindAtRules }];
        syntaxRules['function-no-unknown'] = [true, { ignoreFunctions: tailwindFunctions }];
        syntaxRules['declaration-property-value-no-unknown'] = [
            true,
            { ignoreProperties: { '/.*/': [String.raw`/\btheme\(/`] } },
        ];
    }
    const document = {
        extends: 'stylelint-config-standard',
        rules: Object.assign(
            { ...STYLELINT_BASE_RULES, ...syntaxRules },
            Object.fromEntries((isAll ? [] : [...STYLELINT_RECOMMENDED_OFF]).map((rule) => [rule, null])),
            chosen,
            Object.fromEntries(off.map((rule) => [rule, null])),
        ),
        ...(overrides.length === 0 ? {} : { overrides }),
    };

    return JSON.stringify(document, null, JSON_INDENT);
}
