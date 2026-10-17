// Build the ESLint tool file from the settings and the scope.

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
 * Build the ESLint file from the presets, lint rules, and fragment blocks.
 * @param context the tool file to build.
 * @returns the JavaScript text of the ESLint file.
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
