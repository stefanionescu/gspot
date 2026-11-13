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
import { listProjectDependencyNames } from '#cli/repository/projects/dependencies.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { getTable } from '#cli/settings/tables.ts';
import { buildModuleSpecifier } from '#cli/system/paths.ts';
import type { ConfigBuilder, PlannedConfig } from '#cli/types/configurations/shared.ts';

function buildFunctionValueRule(functions: readonly string[]): unknown {
    return [true, { ignoreProperties: { '/.*/': functions.map((name) => String.raw`/\b${name}\(/`) } }];
}

function keepUnsetRules(
    rules: Record<string, unknown>,
    picked: Record<string, unknown>,
    offRules: string[],
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).filter(([rule]) => !offRules.includes(rule) && picked[rule] === undefined),
    );
}

function buildComponentOverrides(tailwindFunctions: string[], picked: Record<string, unknown>, offRules: string[]) {
    return STYLELINT_COMPONENTS.map((override) => {
        const { files, ignorePseudoClasses } = override;
        const functions = override.functions === undefined ? [] : [...override.functions, ...tailwindFunctions];
        const rules: Record<string, unknown> = {
            'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses }],
            ...(functions.length > 0 && {
                'function-no-unknown': [true, { ignoreFunctions: functions }],
                'declaration-property-value-no-unknown': buildFunctionValueRule(functions),
                'value-keyword-case': ['lower', { ignoreFunctions: override.functions }],
            }),
        };
        return { files, customSyntax: override.customSyntax, rules: keepUnsetRules(rules, picked, offRules) };
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
    return [{ files: [...CSS_MODULES_OVERRIDE.files], rules: keepUnsetRules(rules, picked, offRules) }];
}

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
              'declaration-property-value-no-unknown': buildFunctionValueRule(tailwindFunctions),
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
