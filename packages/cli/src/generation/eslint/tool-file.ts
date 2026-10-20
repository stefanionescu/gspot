// Build the ESLint tool file from the settings and the scope.

import { GspotError } from '#cli/system/errors.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { type ToolFileContext } from '#cli/types/generation/files.ts';
import { buildEslintContext } from '#cli/generation/eslint/context.ts';
import { buildSelectedBlocks } from '#cli/generation/eslint/lint-rules.ts';
import { collectFragments } from '#cli/generation/eslint/fragments/build.ts';
import { listLocalPlugins, buildLocalPluginBlocks } from '#cli/generation/eslint/local-plugins.ts';
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
 *
 * @param context the tool file to build.
 * @returns the JavaScript text of the ESLint file.
 */
function buildEslintFile(context: ToolFileContext): string {
    const { session, selection, toolFile: target } = context;

    const base = buildEslintContext(context);
    const { eslint, blockWriter } = base;
    const { fragmentParts, fragmentImports, fragmentSelectors } = collectFragments(session, target, base);
    const shipped = selectPlugins(base);
    const plugins = { ...shipped, ...listLocalPlugins(session.scopes, context.targetPath, shipped) };
    const output: string[] = [
        serializeImports(plugins, fragmentImports),
        serializeRuntimeSelectors(eslint.runtimes),
        'export default [\n    // Shared ignore sections.\n',
        indentEslintBlock(serializeBlock({ ignores: eslint.ignoredPaths }, '', undefined)),
        ',\n',
        serializeBlocks(blockWriter, buildBlocksBeforeFragments(base, selection.view, plugins)),
        '\n',
        fragmentParts.join('\n'),
        '\n',
        serializeBlocks(blockWriter, buildBlocksAfterFragments(base, selection.view, fragmentSelectors)),
    ];

    if (eslint.extra !== undefined) {
        output.push(
            '\n    // Your own ESLint options.\n',
            indentEslintBlock(JSON.stringify(eslint.extra.entries, null, JSON_INDENT)),
            ',\n',
        );
    }
    output.push(
        serializeBlocks(
            blockWriter,
            [...buildSelectedBlocks(base), ...buildLocalPluginBlocks(session.scopes, base.eslintFiles.code)].map(
                (block) => [block],
            ),
        ),
        '\n];\n',
    );
    const unapplied = blockWriter.listUnappliedRules();
    if (unapplied.length > 0) {
        const level = session.settingsFile.settings.level;
        throw new GspotError(
            'settings',
            unapplied
                .map(
                    (rule) =>
                        `${rule} does not run at level ${level}; gspot sets options only for rules it runs. Use tools.eslint.plugins for your own rules.`,
                )
                .join('\n'),
        );
    }
    return output.join('').trimStart();
}

export { buildEslintFile };
