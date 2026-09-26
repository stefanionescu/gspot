import type { MergedView } from '#cli/policy/merge.ts';
import type { DriftEntry } from '#cli/lifecycle/drift.ts';
import { compareRules } from '#cli/lifecycle/rule-diff.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { eslintPreviewResponse } from '#cli/evaluation/protocol.ts';
import type { GeneratedProposal } from '#cli/generation/proposal.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';

/**
 * Enrich an explicit apply preview with imported and computed ESLint rule data.
 * @param root the repository root
 * @param view the merged view whose ESLint settings the evaluation reads
 * @param signal cancellation for the evaluation
 * @param proposal the generated files
 * @param drift the drift entries the rule differences are added to
 */
export async function eslintRuleDiff(
    root: string,
    view: MergedView | undefined,
    signal: AbortSignal | undefined,
    proposal: GeneratedProposal,
    drift: DriftEntry[],
): Promise<void> {
    const files = openConfinedRoot(root);
    try {
        for (const file of proposal.files) {
            if (!file.path.endsWith('/eslint.config.mjs') || file.rulesPath === undefined) continue;
            const entry = drift.find((candidate) => candidate.path === file.path);
            if (entry === undefined) continue;
            try {
                const current = files.read(file.path)?.bytes.toString('utf8');
                const sources = current === undefined ? [file.content] : [current, file.content];
                const values = eslintPreviewResponse.length(sources.length).parse(
                    await evaluateConfiguration(
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
                entry.rules = compareRules(file.rulesPath, current === undefined ? {} : { rules: values[0] }, {
                    rules: values.at(-1),
                });
                delete entry.ruleError;
            } catch (error) {
                entry.ruleError = `Rule comparison failed: ${error instanceof Error ? error.message.split('\n', 1).join('') : String(error)}`;
                delete entry.rules;
            }
        }
    } finally {
        files.close();
    }
}
