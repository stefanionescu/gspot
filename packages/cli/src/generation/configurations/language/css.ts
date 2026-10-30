import { JSON_INDENT } from '#cli/config/text.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { assertRuleOptionsRun } from '#cli/generation/config-files/rule-options.ts';

import {
    STYLELINT_CHECK,
    TAILWIND_AT_RULES,
    STYLELINT_COMPONENTS,
    CSS_MODULES_OVERRIDE,
    STYLELINT_BASE_RULES,
    STYLELINT_DEFAULT_LEVEL_OFF,
} from '#cli/config/generation/configurations/language/css.ts';

function buildComponentOverrides(tailwindFunctions: string[], picked: Record<string, unknown>, offRules: string[]) {
    return STYLELINT_COMPONENTS.map((override) => {
        const { files, ignorePseudoClasses } = override;
        const functions = override.functions === undefined ? [] : [...override.functions, ...tailwindFunctions];
        const rules: Record<string, unknown> = {
            'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses }],
            ...(functions.length > 0 && {
                'function-no-unknown': [true, { ignoreFunctions: functions }],
                'declaration-property-value-no-unknown': [
                    true,
                    { ignoreProperties: { '/.*/': functions.map((name) => String.raw`/\b${name}\(/`) } },
                ],
                'value-keyword-case': ['lower', { ignoreFunctions: override.functions }],
            }),
        };
        return {
            files,
            customSyntax: override.customSyntax,
            rules: Object.fromEntries(
                Object.entries(rules).filter(([rule]) => !offRules.includes(rule) && picked[rule] === undefined),
            ),
        };
    });
}

function buildCssModulesOverrides(
    planned: PlannedConfigFile,
    tailwindAtRules: readonly string[],
    picked: Record<string, unknown>,
    offRules: string[],
) {
    const scope = planned.scope.path;
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
            rules: Object.fromEntries(
                Object.entries(rules).filter(([rule]) => !offRules.includes(rule) && picked[rule] === undefined),
            ),
        },
    ];
}

/**
Build stylelint.json: the CSS lint presets and rules for this level.

@param planned the config file to build.
*/
export function buildStylelintFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { dependencyFiles } = planned.session.repository;
    const options = getTable(scope.settings, 'tools.stylelint');
    const isAll = planned.level === 'all';
    const scopeDependencies = listProjectDependencyNames(dependencyFiles, scope.path);
    const off = listIgnoredRules(planned.scope, STYLELINT_CHECK);
    const configured = Object.keys(options.rules);
    assertRuleOptionsRun({
        configured,
        running: new Set(configured.filter((rule) => isAll || !STYLELINT_DEFAULT_LEVEL_OFF.has(rule))),
        allLevelRules: STYLELINT_DEFAULT_LEVEL_OFF,
        level: planned.level,
    });
    const picked = options.rules;
    const isTailwind = scopeDependencies.includes('tailwindcss');
    const tailwindAtRules = isTailwind ? TAILWIND_AT_RULES : [];
    const tailwindFunctions = isTailwind ? ['theme'] : [];
    const overrides = [
        ...buildComponentOverrides(tailwindFunctions, picked, off),
        ...buildCssModulesOverrides(planned, tailwindAtRules, picked, off),
    ];
    const syntaxRules = isTailwind
        ? {
              'at-rule-no-unknown': [true, { ignoreAtRules: tailwindAtRules }],

              'function-no-unknown': [true, { ignoreFunctions: tailwindFunctions }],
              'declaration-property-value-no-unknown': [
                  true,
                  { ignoreProperties: { '/.*/': tailwindFunctions.map((name) => String.raw`/\b${name}\(/`) } },
              ],
          }
        : {};
    const document = {
        extends: 'stylelint-config-standard',
        rules: Object.assign(
            { ...STYLELINT_BASE_RULES, ...syntaxRules },
            Object.fromEntries((isAll ? [] : [...STYLELINT_DEFAULT_LEVEL_OFF]).map((rule) => [rule, null])),
            picked,
            Object.fromEntries(off.map((rule) => [rule, null])),
        ),
        ...(overrides.length > 0 && { overrides }),
    };

    return JSON.stringify(document, null, JSON_INDENT);
}
