// The parts of the ESLint configuration that the settings and the emitted scope decide.

import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { buildEslintContext } from '#cli/generation/eslint/context.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/lint-rules.ts';
import { collectFragments } from '#cli/generation/eslint/fragments/build.ts';
import { serializeBlocks, serializeImports, serializeRuntimeSelectors } from '#cli/generation/eslint/print.ts';
import { selectPlugins, buildBlocksAfterFragments, buildBlocksBeforeFragments } from '#cli/generation/eslint/base.ts';

/**
 * Build the ESLint file from the selected presets, rules, and fragment blocks.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the generated JavaScript ESLint configuration.
 */
function buildEslintFile(context: ToolFileContext): string {
    const { session, selection, toolFile: target } = context;

    const base = buildEslintContext(context);
    const pluginLevels = base.pluginLevels;
    const { eslint, json, eslintModule } = base;
    const { fragmentParts, fragmentImports, fragmentSelectors } = collectFragments(
        session,
        session.scopes,
        selection,
        target,
        base,
    );
    const config = eslint;
    const plugins = selectPlugins(base);
    const output: string[] = [
        serializeImports(plugins, fragmentImports),
        serializeRuntimeSelectors(config.runtimes),
        'export default [\n    { ignores: ',
        json(config.ignoredPaths),
        ' },\n',
        serializeBlocks(eslintModule, buildBlocksBeforeFragments(base, selection.view, pluginLevels, plugins)),
        '\n',
        fragmentParts.join('\n'),
        '\n',
        serializeBlocks(eslintModule, buildBlocksAfterFragments(base, selection.view, fragmentSelectors)),
    ];

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

export { buildEslintFile };
