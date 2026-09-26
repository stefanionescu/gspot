// Actionlint's pinned parser predates GitHub's self-repository syntax. Give its

import { join } from 'node:path';
import { readSource } from '#cli/repository/tracked.ts';
import { PRIVATE_FILE } from '#cli/constants/platform.ts';
import { runToolCheck } from '#cli/execution/tool-runner.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import type { CheckResult } from '#cli/types/checks/checks.ts';
import { ACTIONLINT_COMMAND } from '#cli/constants/checks/checks.ts';
import { isAlias, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { createFileWorkspace } from '#cli/execution/file-workspace.ts';
import type { PlannedCheck, Session } from '#cli/types/execution/execution.ts';

// parser equivalent local references in an isolated copy, retaining every offset.
function actionlintSource(text: string): string {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length > 0 || !isMap(document.contents)) return text;
    const references: unknown[] = [];
    const jobs = document.get('jobs', true);
    if (isMap(jobs)) {
        for (const { value: job } of jobs.items) {
            if (!isMap(job)) continue;
            references.push(job.get('uses', true));
            const steps = job.get('steps', true);
            if (isSeq(steps)) {
                for (const step of steps.items) if (isMap(step)) references.push(step.get('uses', true));
            }
        }
    }
    const composite = document.getIn(['runs', 'steps'], true);
    if (isSeq(composite)) {
        for (const step of composite.items) if (isMap(step)) references.push(step.get('uses', true));
    }
    let prepared = text;
    for (const value of references) {
        const reference = isAlias(value) ? value.resolve(document) : value;
        if (!isScalar(reference) || typeof reference.value !== 'string' || !reference.value.startsWith('$/')) continue;
        const token = reference.srcToken;
        if (token === undefined || !('source' in token)) continue;
        const start =
            token.type === 'block-scalar'
                ? token.props.reduce(
                      (end, part) => ('source' in part ? Math.max(end, part.offset + part.source.length) : end),
                      token.offset,
                  )
                : token.offset;
        const source = token.source;
        const replaced = source.replace(/\$|\\x24|\\u0024|\\U00000024/u, (value) =>
            value === '$' ? '.' : value.replace(/24$/u, '2e'),
        );
        prepared = prepared.slice(0, start) + replaced + prepared.slice(start + source.length);
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
        const source = readSource(session.root, file.path, session.observations).toString('utf8');
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
