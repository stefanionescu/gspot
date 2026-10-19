import { serializePresetAccess } from '#cli/generation/eslint/print.ts';
import { TABINDEX_RULES, JSX_CODE_FILES, FOCUSABLE_ROLES } from '#cli/config/generation/eslint-fragments.ts';
import { type EslintContext, type EslintFragment, type FragmentPresets } from '#cli/types/generation/eslint.ts';

/**
 * Let a scrollable region take tabIndex={0}, so that a keyboard can scroll it; the preset allows only tab panels.
 * @param rules the rules of a jsx-a11y preset block.
 * @returns the rules, with the region role allowed in each tabIndex rule.
 */
function allowFocusableRegions(rules: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(rules).map(([rule, entry]) => {
            if (!(TABINDEX_RULES as readonly string[]).includes(rule) || !Array.isArray(entry)) return [rule, entry];
            const [severity, options] = entry as [unknown, Record<string, unknown> | undefined];
            return [rule, [severity, { ...options, roles: [...FOCUSABLE_ROLES] }]];
        }),
    );
}

/**
 * Apply the accessibility lint rules to the React DOM files.
 * @param context the ESLint inputs of the scope.
 * @returns the imports and ESLint blocks for this configuration.
 */
function buildReactDomFragment(
    context: Pick<EslintContext, 'eslintPresets' | 'blockWriter' | 'configurations'>,
): EslintFragment {
    const { eslintPresets, blockWriter, configurations } = context;

    const imports: string[] = ["import accessibility from 'eslint-plugin-jsx-a11y';"];

    const output: string[] = ['\n'];
    if (!configurations.includes('react-native')) {
        const preset = (eslintPresets.get('react-dom') as FragmentPresets).accessibility;
        output.push(
            '\n',
            blockWriter.block(
                {
                    files: JSX_CODE_FILES,
                    ...(preset.blocks[0].rules === undefined
                        ? {}
                        : { rules: allowFocusableRegions(preset.blocks[0].rules) }),
                },
                "plugins: { 'jsx-a11y': accessibility }",
                {
                    expression: `${serializePresetAccess('accessibility', preset.source)}.rules`,
                    rules: preset.blocks[0].rules,
                },
            ),
            ',\n',
        );
    }
    output.push('\n');
    return { imports: imports, blocks: output.join('') };
}

export { allowFocusableRegions, buildReactDomFragment };
