import type { Session } from '#cli/run/session.ts';
import type { DriftEntry } from '#cli/emit/drift.ts';
import { compareRules } from '#cli/emit/rule-diff.ts';
import type { GeneratedProposal } from '#cli/emit/targets.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { eslintPreviewResponse } from '#cli/evaluation/protocol.ts';
import { evaluateConfiguration } from '#cli/evaluation/configuration.ts';

/**
 * Enrich an explicit apply preview with imported and computed ESLint rule data.
 * @param session
 * @param proposal
 * @param drift
 */
export async function eslintRuleDiff(
    session: Session,
    proposal: GeneratedProposal,
    drift: DriftEntry[],
): Promise<void> {
    const files = openConfinedRoot(session.root);
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
                            root: session.root,
                            path: file.path,
                            sources,
                        },
                        session.scopes.find((selection) => selection.scope.path === '')?.view,
                        session.cancelSignal,
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
