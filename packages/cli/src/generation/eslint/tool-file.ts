// The parts of the ESLint configuration that the settings and the emitted scope decide.

import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { buildEslintContext } from '#cli/generation/eslint/context.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/lint-rules.ts';
import { collectFragments } from '#cli/generation/eslint/fragments/build.ts';
import { selectPlugins, buildBlocksAfterFragments, buildBlocksBeforeFragments } from '#cli/generation/eslint/base.ts';

import {
    serializeBlock,
    serializeBlocks,
    serializeImports,
    indentEslintBlock,
    serializeRuntimeSelectors,
} from '#cli/generation/eslint/print.ts';

/**
 * Build the ESLint file from the selected presets, rules, and fragment blocks.
 * @param context the repository, scope settings, tool declaration, and output path.
 * @returns the generated JavaScript ESLint configuration.
 */
function buildEslintFile(context: ToolFileContext): string {
    const { session, selection, toolFile: target } = context;

    const base = buildEslintContext(context);
    const { eslint, json, blockWriter } = base;
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
        'export default [\n    // Shared ignore sections.\n',
        indentEslintBlock(serializeBlock({ ignores: config.ignoredPaths }, '', undefined)),
        ',\n',
        serializeBlocks(blockWriter, buildBlocksBeforeFragments(base, selection.view, plugins)),
        '\n',
        fragmentParts.join('\n'),
        '\n',
        serializeBlocks(blockWriter, buildBlocksAfterFragments(base, selection.view, fragmentSelectors)),
    ];

    if (config.extra !== undefined) {
        output.push('\n    // Your own ESLint options.\n', indentEslintBlock(json(config.extra.entries)), ',\n');
    }
    output.push(
        serializeBlocks(
            blockWriter,
            buildSelectedBlocks(base).map((block) => [block]),
        ),
        '\n];\n',
    );
    return output.join('').trimStart();
}

export { buildEslintFile };
