import {
    CSS_MODULES_OVERRIDE,
    STYLELINT_BASE_RULES,
    STYLELINT_COMPONENTS,
    TAILWIND_AT_RULES,
} from '#cli/config/configurations/language.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import {
    assertRunningRuleOptions,
    listDisabledRules,
    readToolDisabledRules,
} from '#cli/configurations/rule-options.ts';
import { listProjectDependencyNames } from '#cli/repository/dependencies.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { buildModuleSpecifier, isInScope } from '#cli/system/paths.ts';
import type { ConfigBuilder } from '#cli/types/configurations/general.ts';
import type { PlannedConfig } from '#cli/types/configurations/language.ts';

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
    planned: PlannedConfig,
    tailwindAtRules: readonly string[],
    picked: Record<string, unknown>,
    offRules: string[],
) {
    const scopePath = planned.scope.path;
    const hasModules = planned.session.repository.files.some(
        (file) => isInScope(file.path, scopePath) && file.path.endsWith(CSS_MODULES_OVERRIDE.suffix),
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
function buildStylelintFile(planned: PlannedConfig): string {
    const { scope } = planned;
    const { dependencyFiles } = planned.session.repository;
    const options = getTable(scope.settings, 'tools.stylelint');
    const isAll = planned.level === 'all';
    const scopeDependencies = listProjectDependencyNames(dependencyFiles, scope.path);
    const { levelOff } = readToolDisabledRules(planned);
    const off = listDisabledRules({ ...planned, level: 'all' });
    const configured = Object.keys(options.rules);
    assertRunningRuleOptions({
        configured,
        running: new Set(configured.filter((rule) => isAll || !levelOff.includes(rule))),
        allLevelRules: new Set(levelOff),
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
    const plugins = options.plugins.map(
        (plugin) => plugin.package ?? buildModuleSpecifier(planned.targetPath, plugin.path as string),
    );
    const document = {
        extends: 'stylelint-config-standard',
        ...(plugins.length > 0 && { plugins }),
        rules: {
            ...STYLELINT_BASE_RULES,
            ...syntaxRules,
            ...Object.fromEntries((isAll ? [] : levelOff).map((rule) => [rule, null])),
            ...picked,
            ...Object.fromEntries(options.plugins.flatMap(({ rules }) => Object.entries(rules))),
            ...Object.fromEntries(off.map((rule) => [rule, null])),
        },
        ...(overrides.length > 0 && { overrides }),
    };

    return JSON.stringify(document, null, JSON_INDENT);
}

export const CSS_CONFIG_BUILDERS: Readonly<Record<string, ConfigBuilder>> = {
    'css/stylelint.json': buildStylelintFile,
};
