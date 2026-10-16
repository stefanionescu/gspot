// The parts of the ESLint configuration that the settings and the emitted scope decide.
import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { buildEslintContext } from '#cli/generation/eslint/context.ts';
import { ESLINT_RULE_LEVELS_FILE } from '#cli/config/generation/eslint.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/lint-rules.ts';
import { collectFragments } from '#cli/generation/eslint/fragments/build.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { serializeBlocks, serializeImports, serializeRuntimeSelectors } from '#cli/generation/eslint/print.ts';
import { selectPlugins, buildBlocksAfterFragments, buildBlocksBeforeFragments } from '#cli/generation/eslint/base.ts';

/**
 * Write ESLint settings for every selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.session the repository session.
 * @param root0.selection the selected scope and its settings.
 *
 * @returns the generated configuration text.
 */
export function buildEslintFile({ session, selection }: ToolFileContext): string {
    const pluginLevels = (
        z.record(z.string(), z.enum(LEVELS).or(z.literal('none'))) satisfies z.ZodType<
            Record<string, (typeof LEVELS)[number] | 'none'>
        >
    ).parse(JSON.parse(readAsset(ESLINT_RULE_LEVELS_FILE)));
    const base = buildEslintContext(session, selection, pluginLevels);
    const javascript = session.manifests.get('javascript') as Manifest;
    const target = javascript.toolFiles.find(
        (file) => file.target.endsWith('/eslint.config.mjs') && !file.fragment,
    ) as ToolFileDeclaration;
    const { eslint, json } = base;
    const { eslintModule, eslintFiles, eslintFragmentBlocks, fragmentParts, fragmentImports, fragmentSelectors } =
        collectFragments(session, session.scopes, selection, target, base);
    base.eslintFiles = eslintFiles;
    const config = eslint();
    const plugins = selectPlugins(base);
    const output: string[] = [
        serializeImports(plugins, fragmentImports),
        serializeRuntimeSelectors(config.runtimes),
        'export default [\n    { ignores: ',
        json(config.ignoredPaths),
        ' },\n',
        serializeBlocks(eslintModule, buildBlocksBeforeFragments(base, selection.view, pluginLevels, plugins)),
    ];
    eslintModule.blocks.push(...eslintFragmentBlocks);
    output.push(
        '\n',
        fragmentParts.join('\n'),
        '\n',
        serializeBlocks(eslintModule, buildBlocksAfterFragments(base, selection.view, fragmentSelectors)),
    );

    if (config.extra !== undefined) {
        output.push('\n    ', json(config.extra.entries), ',\n');
    }
    output.push(
        serializeBlocks(
            eslintModule,
            buildSelectedBlocks(base).map((block) => [block]),
        ),
        '\n];\n',
    );
    return output.join('').trimStart();
}
