import { join, posix } from 'node:path';
import type { Session } from '#cli/types/tools.ts';
import { PRIVATE_FILE } from '#cli/config/system.ts';
import { readText } from '#cli/system/files/reads.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { restoreCommandPaths } from '#cli/engine/results.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { WorkflowShapeHit } from '#cli/types/configurations/infrastructure.ts';
import { type CheckCode, type CheckResult, type CheckSession } from '#cli/types/engine/run.ts';
import { WORKFLOW_SHAPE_RULE_DOCS } from '#cli/config/configurations/rule-docs/infrastructure.ts';

import {
    isMap,
    isSeq,
    isAlias,
    isScalar,
    type Scalar,
    LineCounter,
    type YAMLMap,
    parseDocument,
    type Document,
} from 'yaml';
import {
    GIT_FOLDER,
    ACTION_FILES,
    GITHUB_FOLDER,
    FLOATING_RUNNER,
    WORKFLOW_EXPRESSION,
    WORKFLOW_SHAPE_RULES,
    PULL_REQUEST_TRIGGERS,
    SELF_REFERENCE_PREFIX,
    ENCODED_DOLLAR_SUFFIX,
    UPLOAD_ARTIFACT_ACTION,
    SELF_REPOSITORY_MARKER,
    WORKFLOW_SHAPE_MESSAGES,
} from '#cli/config/configurations/infrastructure.ts';

function listStepReferences(steps: unknown): unknown[] {
    if (!isSeq(steps)) return [];
    const mappings = steps.items.filter(isMap);
    return mappings.map((step) => step.get('uses', true));
}

function listWorkflowReferences(document: Document): unknown[] {
    const references: unknown[] = [];
    const jobs = document.get('jobs', true);
    if (isMap(jobs)) {
        for (const { value: job } of jobs.items) {
            if (!isMap(job)) continue;
            references.push(job.get('uses', true), ...listStepReferences(job.get('steps', true)));
        }
    }
    references.push(...listStepReferences(document.getIn(['runs', 'steps'], true)));
    return references;
}

function replaceReference(text: string, reference: Scalar): string {
    const token = reference.srcToken;
    if (token === undefined || !('source' in token)) return text;
    const start =
        token.type === 'block-scalar'
            ? Math.max(
                  token.offset,
                  ...token.props.map((prop) => ('source' in prop ? prop.offset + prop.source.length : token.offset)),
              )
            : token.offset;
    const replaced = token.source.replace(
        SELF_REPOSITORY_MARKER,
        (_, prefix: string, marker: string) =>
            prefix + (marker === '$' ? '.' : marker.replace(ENCODED_DOLLAR_SUFFIX, '2e')),
    );
    return text.slice(0, start) + replaced + text.slice(start + token.source.length);
}

function replaceSelfReferences(text: string): string {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length > 0 || !isMap(document.contents)) return text;
    let replaced = text;
    for (const value of listWorkflowReferences(document)) {
        const reference = isAlias(value) ? value.resolve(document) : value;
        if (
            !isScalar(reference) ||
            typeof reference.value !== 'string' ||
            !reference.value.startsWith(SELF_REFERENCE_PREFIX)
        )
            continue;
        replaced = replaceReference(replaced, reference);
    }
    return replaced;
}

function listTriggers(document: Document): string[] {
    const triggers = document.get('on', true);
    if (isScalar(triggers)) return [String(triggers.value)];
    if (isSeq(triggers)) return triggers.items.filter(isScalar).map((trigger) => String(trigger.value));
    return isMap(triggers) ? triggers.items.map((pair) => String(pair.key)) : [];
}

function findKey(map: YAMLMap, name: string): Scalar | undefined {
    return map.items.map((pair) => pair.key).find((key): key is Scalar => isScalar(key) && key.value === name);
}

function listFlagHits(job: YAMLMap): WorkflowShapeHit[] {
    const hits: WorkflowShapeHit[] = [];
    const flag = findKey(job, 'continue-on-error');
    if (flag !== undefined && job.get('continue-on-error') !== false)
        hits.push({ kind: 'continueOnError', node: flag });
    return hits;
}

function listStepHits(step: YAMLMap): WorkflowShapeHit[] {
    const run = step.get('run', true);
    const uses = step.get('uses');
    return [
        ...listFlagHits(step),
        ...(isScalar(run) && String(run.value).includes(WORKFLOW_EXPRESSION)
            ? [{ kind: 'runExpression' as const, node: run }]
            : []),
        ...(typeof uses === 'string' &&
        uses.startsWith(UPLOAD_ARTIFACT_ACTION) &&
        !step.hasIn(['with', 'retention-days'])
            ? [{ kind: 'retention' as const, node: findKey(step, 'uses') as Scalar }]
            : []),
    ];
}

function listJobHits(name: Scalar, job: YAMLMap): WorkflowShapeHit[] {
    const runner = job.get('runs-on', true);
    const steps = job.get('steps', true);
    return [
        ...(job.has('uses') || job.has('timeout-minutes') ? [] : [{ kind: 'timeout' as const, node: name }]),
        ...(isScalar(runner) && FLOATING_RUNNER.test(String(runner.value))
            ? [{ kind: 'latestRunner' as const, node: runner }]
            : []),
        ...listFlagHits(job),
        ...(isSeq(steps) ? steps.items.filter(isMap).flatMap((step) => listStepHits(step)) : []),
    ];
}

function listConcurrencyHits(document: Document & { contents: YAMLMap }): WorkflowShapeHit[] {
    const triggers = listTriggers(document);
    const group = findKey(document.contents, 'concurrency');
    const anchor = findKey(document.contents, 'on') ?? (document.contents.items[0]?.key as Scalar);
    const isPullRequestRun = triggers.some((trigger) => PULL_REQUEST_TRIGGERS.has(trigger));
    return isPullRequestRun && group === undefined ? [{ kind: 'pullRequestConcurrency', node: anchor }] : [];
}

/**
Runs actionlint. If a workflow or action uses a $/ reference, checks a copy with that reference changed to ./.

@param session the repository and its tools.
@param planned the actionlint check and its files.
*/
async function checkActionlint(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const replacements = new Map<string, string>();
    const actionFiles = new Map(
        [
            ...planned.files,
            ...session.repository.files.filter((file) => ACTION_FILES.includes(posix.basename(file.path))),
        ].map((file) => [file.path, file]),
    );
    for (const file of actionFiles.values()) {
        const source = readText(session.cache, file.path);
        const replaced = replaceSelfReferences(source);
        if (replaced !== source) replacements.set(file.path, replaced);
    }
    if (replacements.size === 0) return runCommandCheck(session, planned);
    using scratch = await createCopy(session, [
        ...new Set([
            ...session.repository.files.filter((file) => file.path.startsWith(GITHUB_FOLDER)).map((file) => file.path),
            ...actionFiles.keys(),
        ]),
    ]);
    mkdirSync(join(scratch.path, GIT_FOLDER));
    for (const [path, source] of replacements) {
        const target = join(scratch.path, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    const result = await runCommandCheck({ ...session, root: scratch.path }, planned);
    return restoreCommandPaths(result, scratch.path, session.root);
}

/**
Reports each workflow that breaks the shape rules of GITHUB-ACTIONS.md: job limits, runners, concurrency, comments on
`continue-on-error`, expressions in `run:`, and artifact retention.

@param session the repository file cache.
@param planned the selected workflow files.
*/
function checkWorkflowShape(session: Session, planned: PlannedCheck): CheckFinding[] {
    return planned.files.flatMap(({ path }) => {
        const text = readText(session.cache, path);
        const lines = new LineCounter();
        const document = parseDocument(text, { lineCounter: lines });
        if (document.errors.length > 0 || !isMap(document.contents)) return [];
        const source = text.split('\n');
        const jobs = document.get('jobs', true);
        const jobHits = isMap(jobs)
            ? jobs.items.flatMap(({ key, value }) => (isScalar(key) && isMap(value) ? listJobHits(key, value) : []))
            : [];
        return [...listConcurrencyHits(document as Document & { contents: YAMLMap }), ...jobHits].flatMap(
            ({ kind, node }) => {
                const { line } = lines.linePos(node.range?.[0] ?? 0);
                const previous = source.slice(0, line - 1).at(-1);
                if (kind === 'continueOnError' && previous?.trimStart().startsWith('#') === true) return [];
                return [
                    {
                        file: path,
                        line,
                        rule: WORKFLOW_SHAPE_RULES[kind],
                        message: WORKFLOW_SHAPE_MESSAGES[kind],
                    },
                ];
            },
        );
    });
}

export const GITHUB_ACTIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'github-actions/actionlint': { run: checkActionlint },
    'github-actions/workflow-shape': { check: checkWorkflowShape, ruleDocs: WORKFLOW_SHAPE_RULE_DOCS },
};
