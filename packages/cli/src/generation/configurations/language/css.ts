import { readFileSync } from 'node:fs';
import { JSON_INDENT } from '#cli/config/text.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { buildAssetPath } from '#cli/system/assets.ts';
import { getTable, listIgnoredRules } from '#cli/settings/scopes.ts';
import type { PlannedConfigFile } from '#cli/types/generation/files.ts';
import { nameListSchema } from '#cli/schemas/configurations/name-lists.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { assertRuleOptionsRun } from '#cli/generation/config-files/rule-options.ts';

import {
    TAILWIND_AT_RULES,
    STYLELINT_COMPONENTS,
    CSS_MODULES_OVERRIDE,
    STYLELINT_BASE_RULES,
    STYLELINT_RECOMMENDED_OFF,
    STYLELINT_RULE_NAMES_FILE,
} from '#cli/config/generation/configurations/language/css.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function dropPickedRules(
    rules: Record<string, unknown>,
    picked: Record<string, unknown>,
    off: string[],
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).filter(([rule]) => !off.includes(rule) && picked[rule] === undefined),
    );
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
function buildFunctionRules(functions: readonly string[]): Record<string, unknown> {
    return {
        'function-no-unknown': [true, { ignoreFunctions: functions }],
        'declaration-property-value-no-unknown': [
            true,
            { ignoreProperties: { '/.*/': functions.map((name) => String.raw`/\b${name}\(/`) } },
        ],
    };
}

function buildComponentOverrides(
    configurations: string[],
    tailwindFunctions: string[],
    picked: Record<string, unknown>,
    off: string[],
) {
    return configurations
        .flatMap((name) => STYLELINT_COMPONENTS[name] ?? [])
        .map((override) => {
            const { files, ignorePseudoClasses } = override;
            const functions = override.functions === undefined ? [] : [...override.functions, ...tailwindFunctions];
            const rules: Record<string, unknown> = {
                'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses }],
                ...(functions.length > 0 && {
                    ...buildFunctionRules(functions),
                    'value-keyword-case': ['lower', { ignoreFunctions: override.functions }],
                }),
            };
            return {
                files,
                customSyntax: override.customSyntax,
                rules: dropPickedRules(rules, picked, off),
            };
        });
}

function buildCssModulesOverrides(
    planned: PlannedConfigFile,
    tailwindAtRules: readonly string[],
    picked: Record<string, unknown>,
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
            rules: dropPickedRules(rules, picked, off),
        },
    ];
}

/**
Build stylelint.json: the CSS lint presets and rules for this level.

@param planned the config file with its scope, level, and target path.
@returns the CSS lint presets and rules for this level.
*/
export function buildStylelintFile(planned: PlannedConfigFile): string {
    const { scope } = planned;
    const { dependencyFiles } = planned.session.repository;
    const { configurations } = scope.settings;
    const options = getTable(scope.settings, 'tools.stylelint');
    const isAll = planned.level === 'all';
    const scopeDependencies = listProjectDependencyNames(dependencyFiles, scope.folder.path);
    const ruleNamesFile = buildAssetPath(STYLELINT_RULE_NAMES_FILE);
    const stylelintRuleNames = nameListSchema.parse(JSON.parse(readFileSync(ruleNamesFile, 'utf8'))).names;

    const off = listIgnoredRules(planned.scope, 'css/stylelint');
    const activeRules = new Set(
        [...stylelintRuleNames, 'function-no-unknown'].filter((rule) => isAll || !STYLELINT_RECOMMENDED_OFF.has(rule)),
    );
    assertRuleOptionsRun({
        configured: Object.keys(options.rules),
        running: activeRules,
        higher: STYLELINT_RECOMMENDED_OFF,
        level: planned.level,
    });
    const picked = options.rules;
    const isTailwind = scopeDependencies.includes('tailwindcss');
    const tailwindAtRules = isTailwind ? TAILWIND_AT_RULES : [];
    const tailwindFunctions = isTailwind ? ['theme'] : [];
    const overrides = [
        ...buildComponentOverrides(configurations, tailwindFunctions, picked, off),
        ...buildCssModulesOverrides(planned, tailwindAtRules, picked, off),
    ];
    const syntaxRules = isTailwind
        ? {
              'at-rule-no-unknown': [true, { ignoreAtRules: tailwindAtRules }],
              ...buildFunctionRules(tailwindFunctions),
          }
        : {};
    const document = {
        extends: 'stylelint-config-standard',
        rules: Object.assign(
            { ...STYLELINT_BASE_RULES, ...syntaxRules },
            Object.fromEntries((isAll ? [] : [...STYLELINT_RECOMMENDED_OFF]).map((rule) => [rule, null])),
            picked,
            Object.fromEntries(off.map((rule) => [rule, null])),
        ),
        ...(overrides.length > 0 && { overrides }),
    };

    return JSON.stringify(document, null, JSON_INDENT);
}
