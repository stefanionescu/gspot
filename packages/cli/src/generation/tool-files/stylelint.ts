import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import type { SchemaShape } from '#cli/types/objects.ts';
import { VUE_STYLELINT_OVERRIDE } from '#cli/config/planning.ts';
import type { RuleNamesFile } from '#cli/types/generation/eslint.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { selectStylelintComponents } from '#cli/planning/needed-tools.ts';
import { getProjectDependencies } from '#cli/repository/dependency-files.ts';

import {
    TAILWIND_AT_RULES,
    STYLELINT_BASE_RULES,
    STYLELINT_ALL_LEVEL_RULES,
    STYLELINT_RULE_NAMES_FILE,
} from '#cli/config/generation/tool-file-sources.ts';

/**
 * Component parsers need file-specific pseudo-class and function rules.
 *
 * @param configurations the selected configuration names.
 * @param tailwindFunctions the Tailwind functions accepted in component styles.
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

const ruleNamesFileSchema = z.strictObject({
    package: z.string().min(1),
    version: z.string().min(1),
    source: z.string().min(1),
    rules: z.array(z.string().min(1)),
} satisfies SchemaShape<RuleNamesFile>) satisfies z.ZodType<RuleNamesFile>;
/**
 * Build stylelint file from the selected settings.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the CSS lint presets and rules selected for this level.
 */
function buildStylelintFile(context: ToolFileContext): string {
    const { selection } = context;
    const { packageManifests } = context.session;
    const level = context.level;

    const { rulesOff, configurations } = selection.view;
    const options = selection.view.options('tools.stylelint');
    const isAll = level === 'all';
    const scopeDependencies = Object.keys(getProjectDependencies(packageManifests, selection.scope.path));
    const stylelintRuleNames = ruleNamesFileSchema.parse(JSON.parse(readAsset(STYLELINT_RULE_NAMES_FILE))).rules;

    const off = rulesOff('css/stylelint');
    const activeRules = new Set(
        [...stylelintRuleNames, 'function-no-unknown'].filter((rule) => isAll || !STYLELINT_ALL_LEVEL_RULES.has(rule)),
    );
    const chosen = Object.fromEntries(Object.entries(options.rules).filter(([rule]) => activeRules.has(rule)));
    const tailwind = scopeDependencies.includes('tailwindcss');
    const tailwindAtRules = tailwind ? TAILWIND_AT_RULES : [];
    const tailwindFunctions = tailwind ? ['theme'] : [];
    const overrides = buildComponentOverrides(configurations, tailwindFunctions, chosen, off);
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
export { ruleNamesFileSchema };
