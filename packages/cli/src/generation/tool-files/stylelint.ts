import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { selectStylelintComponents } from '#cli/planning/needed-tools.ts';
import { readLintRuleNames } from '#cli/configurations/lint-rule-names.ts';
import { listProjectDependencyNames } from '#cli/repository/dependency-files.ts';

import {
    TAILWIND_AT_RULES,
    CSS_MODULES_OVERRIDE,
    STYLELINT_BASE_RULES,
    VUE_STYLELINT_OVERRIDE,
    STYLELINT_ALL_LEVEL_RULES,
    STYLELINT_RULE_NAMES_FILE,
} from '#cli/config/generation/tool-files.ts';

/**
 * Build the component parser overrides, which need their own pseudo-class and function rules.
 *
 * @param configurations the configuration names in use.
 * @param tailwindFunctions the Tailwind helpers that component styles may call.
 * @param chosen the authored rule options.
 * @param off the disabled lint rule names.
 *
 * @returns the component parser overrides.
 */
function buildComponentOverrides(
    configurations: string[],
    tailwindFunctions: string[],
    chosen: Record<string, unknown>,
    off: string[],
) {
    return selectStylelintComponents(configurations).map((override) => {
        const { files, ignorePseudoClasses } = override;
        const functions =
            override === VUE_STYLELINT_OVERRIDE ? [...VUE_STYLELINT_OVERRIDE.functions, ...tailwindFunctions] : [];
        const rules: Record<string, unknown> = {
            'selector-pseudo-class-no-unknown': [true, { ignorePseudoClasses }],
            ...(functions.length === 0
                ? {}
                : {
                      'function-no-unknown': [true, { ignoreFunctions: functions }],
                      'value-keyword-case': ['lower', { ignoreFunctions: VUE_STYLELINT_OVERRIDE.functions }],
                      'declaration-property-value-no-unknown': [
                          true,
                          { ignoreProperties: { '/.*/': functions.map((name) => String.raw`/\b${name}\(/`) } },
                      ],
                  }),
        };
        return {
            files,
            customSyntax: override.customSyntax,
            rules: Object.fromEntries(
                Object.entries(rules).filter(([rule]) => !off.includes(rule) && chosen[rule] === undefined),
            ),
        };
    });
}

// A scope with CSS Modules files accepts their syntax in those files. The override keeps the Tailwind at-rules.
function buildCssModulesOverrides(
    context: ToolFileContext,
    tailwindAtRules: readonly string[],
    chosen: Record<string, unknown>,
    off: string[],
) {
    const scope = context.selection.scope.path;
    const hasModules = context.session.repository.files.some(
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
                Object.entries(rules).filter(([rule]) => !off.includes(rule) && chosen[rule] === undefined),
            ),
        },
    ];
}

/**
 * Build the Stylelint file from the settings.
 *
 * @param context the tool file to build.
 * @returns the CSS lint presets and rules for this level.
 */
function buildStylelintFile(context: ToolFileContext): string {
    const { selection } = context;
    const { dependencyFiles } = context.session.repository;
    const level = context.level;

    const { rulesOff, configurations } = selection.view;
    const options = selection.view.options('tools.stylelint');
    const isAll = level === 'all';
    const scopeDependencies = listProjectDependencyNames(dependencyFiles, selection.scope.path);
    const stylelintRuleNames = readLintRuleNames(STYLELINT_RULE_NAMES_FILE).rules;

    const off = rulesOff('css/stylelint');
    const activeRules = new Set(
        [...stylelintRuleNames, 'function-no-unknown'].filter((rule) => isAll || !STYLELINT_ALL_LEVEL_RULES.has(rule)),
    );
    const refused = Object.keys(options.rules).filter((rule) => !activeRules.has(rule));
    if (refused.length > 0)
        throw new GspotError(
            'settings',
            refused
                .map((rule) => `${rule} does not run at level ${level}; gspot sets options only for rules it runs.`)
                .join('\n'),
        );
    const chosen = options.rules;
    const tailwind = scopeDependencies.includes('tailwindcss');
    const tailwindAtRules = tailwind ? TAILWIND_AT_RULES : [];
    const tailwindFunctions = tailwind ? ['theme'] : [];
    const overrides = [
        ...buildComponentOverrides(configurations, tailwindFunctions, chosen, off),
        ...buildCssModulesOverrides(context, tailwindAtRules, chosen, off),
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
            Object.fromEntries((isAll ? [] : [...STYLELINT_ALL_LEVEL_RULES]).map((rule) => [rule, null])),
            chosen,
            Object.fromEntries(off.map((rule) => [rule, null])),
        ),
        ...(overrides.length === 0 ? {} : { overrides }),
    };

    return `${JSON.stringify(document, null, JSON_INDENT)}\n`;
}

export { buildStylelintFile };
