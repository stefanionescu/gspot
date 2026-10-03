import { openRoot } from '#cli/platform/filesystem.ts';
import type { MergedView } from '#cli/types/policy/policy.ts';
import type { Drift } from '#cli/types/lifecycle/lifecycle.ts';
import { compareRules } from '#cli/lifecycle/preview/compare.ts';
import { evaluate } from '#cli/lifecycle/preview/eslint/client.ts';
import type { Generated } from '#cli/types/generation/generation.ts';
import { eslintPreviewResponse } from '#cli/lifecycle/preview/eslint/protocol.ts';

/**
 * Enrich an explicit apply preview with imported and computed ESLint rule data.
 * @param root the repository root
 * @param view the merged view whose ESLint settings the evaluation reads
 * @param signal cancellation for the evaluation
 * @param plan the generated files
 * @param drift the drift entries the rule differences are added to
 */
export async function diffEslintRules(
    root: string,
    view: MergedView | undefined,
    signal: AbortSignal | undefined,
    plan: Generated,
    drift: Drift[],
): Promise<void> {
    const selected = plan.files.flatMap((file) => {
        if (!file.path.endsWith('/eslint.config.mjs') || file.rulePaths === undefined) return [];
        const entry = drift.find((candidate) => candidate.path === file.path);
        return entry === undefined ? [] : [{ file, entry, rulePaths: file.rulePaths }];
    });
    using files = openRoot(root);
    for (const { file, entry, rulePaths } of selected) {
        try {
            const current = files.read(file.path)?.bytes.toString('utf8');
            const sources = [current, file.content].filter((source) => source !== undefined);
            const resolvedRules = eslintPreviewResponse.length(sources.length).parse(
                await evaluate(
                    {
                        tool: 'eslint',
                        operation: 'preview-rules',
                        root: root,
                        path: file.path,
                        sources,
                    },
                    view,
                    signal,
                ),
            );
            entry.rules = compareRules(rulePaths, current === undefined ? {} : { rules: resolvedRules[0] }, {
                rules: resolvedRules.at(-1),
            });
            delete entry.ruleError;
        } catch (error) {
            entry.ruleError = `Rule comparison failed: ${error instanceof Error ? error.message.split('\n', 1).join('') : String(error)}`;
            delete entry.rules;
        }
    }
}
