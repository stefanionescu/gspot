import { join } from 'node:path';
import type { Scalar, Document } from 'yaml';
import { PRIVATE_FILE } from '#cli/config/platform.ts';
import type { CheckResult } from '#cli/types/checks.ts';
import { readSource } from '#cli/repository/sources.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { ACTIONLINT_COMMAND } from '#cli/config/checks/repository.ts';
import { isMap, isSeq, isAlias, isScalar, parseDocument } from 'yaml';
import { createFileWorkspace } from '#cli/execution/tool/workspace.ts';
import type { Session, PlannedCheck } from '#cli/types/execution/execution.ts';

function stepReferences(steps: unknown): unknown[] {
    if (!isSeq(steps)) return [];
    const mappings = steps.items.filter(isMap);
    return mappings.map((step) => step.get('uses', true));
}

function workflowReferences(document: Document): unknown[] {
    const references: unknown[] = [];
    const jobs = document.get('jobs', true);
    if (isMap(jobs)) {
        for (const { value: job } of jobs.items) {
            if (!isMap(job)) continue;
            references.push(job.get('uses', true), ...stepReferences(job.get('steps', true)));
        }
    }
    references.push(...stepReferences(document.getIn(['runs', 'steps'], true)));
    return references;
}

// Change only the self-repository marker. Later dollar signs belong to the referenced path.
function replaceReference(text: string, reference: Scalar): string {
    const token = reference.srcToken;
    if (token === undefined || !('source' in token)) return text;
    const start =
        token.type === 'block-scalar'
            ? Math.max(
                  token.offset,
                  ...token.props.map((part) => ('source' in part ? part.offset + part.source.length : token.offset)),
              )
            : token.offset;
    const source = token.source;
    const replaced = source.replace(/\$|\\x24|\\u0024|\\U00000024/u, (value) =>
        value === '$' ? '.' : value.replace(/24$/u, '2e'),
    );
    return text.slice(0, start) + replaced + text.slice(start + source.length);
}

// Actionlint predates self-repository syntax. Substitute local references while preserving offsets.
function actionlintSource(text: string): string {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length > 0 || !isMap(document.contents)) return text;
    let prepared = text;
    for (const value of workflowReferences(document)) {
        const reference = isAlias(value) ? value.resolve(document) : value;
        if (!isScalar(reference) || typeof reference.value !== 'string' || !reference.value.startsWith('$/')) continue;
        prepared = replaceReference(prepared, reference);
    }
    return prepared;
}

/**
 * Validate current GitHub reference syntax through the supervised native parser without editing authored files.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function checkActions(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const replacements = new Map<string, string>();
    for (const file of session.repository.files) {
        if (!/\.ya?ml$/u.test(file.path)) continue;
        const source = readSource(session.root, file.path, session.reads).toString('utf8');
        const prepared = actionlintSource(source);
        if (prepared !== source) replacements.set(file.path, prepared);
    }
    if (replacements.size === 0) return runToolCheck(session, planned, ACTIONLINT_COMMAND);
    using workspace = createFileWorkspace(
        session.root,
        session.repository.files.map((file) => file.path),
    );
    // Actionlint discovers local reusable workflows only inside a Git project.
    mkdirSync(join(workspace.root, '.git'));
    for (const [path, source] of replacements) {
        const target = join(workspace.root, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    return await runToolCheck({ ...session, root: workspace.root }, planned, ACTIONLINT_COMMAND);
}
