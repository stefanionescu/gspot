// The parts of the ESLint configuration that the settings and the emitted scope decide.
import { z } from 'zod';
import { readAsset } from '#cli/system/assets.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { eslintInputs } from '#cli/generation/eslint/inputs.ts';
import { collectFragments } from '#cli/generation/fragments.ts';
import { appliedBlocks } from '#cli/generation/eslint/blocks.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { ESLINT_RULE_LEVELS_FILE } from '#cli/config/generation/eslint.ts';
import type { Manifest, ToolFileDeclaration } from '#cli/types/configurations.ts';
import { codeBlocks, fileBlocks, eslintPlugins } from '#cli/generation/eslint/defaults.ts';
import { emitBlocks, eslintImports, selectorDefinitions } from '#cli/generation/eslint/serialize.ts';

/**
 * Write ESLint settings for every selected scope.
 *
 * @param root0 the values for this generated file.
 * @param root0.session the repository session.
 * @param root0.selection the selected scope and its settings.
 *
 * @returns the generated configuration text.
 */
export function eslintConfiguration({ session, selection }: ToolFileContext): string {
    const pluginLevels = (
        z.record(z.string(), z.enum(LEVELS).or(z.literal('none'))) satisfies z.ZodType<
            Record<string, (typeof LEVELS)[number] | 'none'>
        >
    ).parse(JSON.parse(readAsset(ESLINT_RULE_LEVELS_FILE)));
    const base = eslintInputs(session, selection, pluginLevels);
    const javascript = session.manifests.get('javascript') as Manifest;
    const target = javascript.toolFiles.find(
        (file) => file.target.endsWith('/eslint.config.mjs') && !file.fragment,
    ) as ToolFileDeclaration;
    const { eslint, json } = base;
    const { eslintModule, eslintFiles, eslintFragmentBlocks, fragmentParts, fragmentImports, fragmentSelectors } =
        collectFragments(session, session.scopes, selection, target, base);
    base.eslintFiles = eslintFiles;
    const config = eslint();
    const plugins = eslintPlugins(base);
    const output: string[] = [
        eslintImports(plugins, fragmentImports),
        selectorDefinitions(config.runtimes),
        'export default [\n    { ignores: ',
        json(config.ignoredPaths),
        ' },\n',
        emitBlocks(eslintModule, codeBlocks(base, selection.view, pluginLevels, plugins)),
    ];
    eslintModule.blocks.push(...eslintFragmentBlocks);
    output.push(
        '\n',
        fragmentParts.join('\n'),
        '\n',
        emitBlocks(eslintModule, fileBlocks(base, selection.view, fragmentSelectors)),
    );

    if (config.extra !== undefined) {
        output.push('\n    ', json(config.extra.entries), ',\n');
    }
    output.push(
        emitBlocks(
            eslintModule,
            appliedBlocks(base).map((block) => [block]),
        ),
        '\n];\n',
    );
    return output.join('').trimStart();
}
