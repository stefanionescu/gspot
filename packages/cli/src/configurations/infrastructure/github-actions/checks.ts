import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import {
    type Document,
    isAlias,
    isMap,
    isScalar,
    isSeq,
    LineCounter,
    parseDocument,
    type Scalar,
    type YAMLMap,
} from 'yaml';

import {
    ACTION_FILES,
    ENCODED_DOLLAR_SUFFIX,
    FLOATING_RUNNER,
    GITHUB_FOLDER,
    PULL_REQUEST_TRIGGERS,
    SECRET_EXPRESSION,
    SELF_REFERENCE_PREFIX,
    SELF_REPOSITORY_MARKER,
    UPLOAD_ARTIFACT_ACTION,
    WORKFLOW_EXPRESSION,
    WORKFLOW_SHAPE_MESSAGES,
    WORKFLOW_SHAPE_RULES,
} from '#cli/config/configurations/github-actions.ts';
import { GIT_METADATA_NAME, PRIVATE_FILE } from '#cli/config/system.ts';
import { WORKFLOW_SHAPE_EXPLANATIONS } from '#cli/configurations/infrastructure/github-actions/explanations.ts';
import { createCopy } from '#cli/engine/copies/files.ts';
import { restoreCommandPaths } from '#cli/engine/results.ts';
import { runCommandCheck } from '#cli/engine/tool-runs/check.ts';
import { parseBashScript } from '#cli/parsers/code/bash/script.ts';
import { readText } from '#cli/system/files/reads.ts';
import type { WorkflowShapeHit } from '#cli/types/configurations/infrastructure.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckCode, CheckFinding, CheckResult, CheckSession } from '#cli/types/engine/run.ts';
import type { Session } from '#cli/types/tools.ts';

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

function listSecretHits(document: Document & { contents: YAMLMap }): WorkflowShapeHit[] {
    const environment = document.contents.get('env', true);
    if (!isMap(environment)) return [];
    return environment.items.flatMap(({ value }) =>
        isScalar(value) && SECRET_EXPRESSION.test(String(value.value))
            ? [{ kind: 'workflowSecret' as const, node: value }]
            : [],
    );
}

function listRunScripts(jobs: unknown): Scalar[] {
    if (!isMap(jobs)) return [];
    return jobs.items.flatMap(({ value: job }) => {
        const steps = isMap(job) ? job.get('steps', true) : undefined;
        if (!isSeq(steps)) return [];
        return steps.items.filter(isMap).flatMap((step) => {
            const run = step.get('run', true);
            return isScalar(run) ? [run] : [];
        });
    });
}

/**
Report each `run:` script that pipes a download into a shell, with the Bash parser of bash/safety. A block scalar starts
its script on the line after `run:`.
*/
async function listDownloadRuns(path: string, runs: Scalar[], lines: LineCounter): Promise<CheckFinding[]> {
    const found = await Promise.all(
        runs.map(async (run) => {
            const { forms } = await parseBashScript(String(run.value));
            const { line } = lines.linePos(run.range?.[0] ?? 0);
            const isBlock = run.type === 'BLOCK_LITERAL' || run.type === 'BLOCK_FOLDED';
            return forms
                .filter(({ form }) => form === 'curl-pipe-shell')
                .map((form) => ({
                    file: path,
                    line: line + form.line - (isBlock ? 0 : 1),
                    rule: WORKFLOW_SHAPE_RULES.downloadRun,
                    message: WORKFLOW_SHAPE_MESSAGES.downloadRun,
                }));
        }),
    );
    return found.flat();
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
    mkdirSync(join(scratch.path, GIT_METADATA_NAME));
    for (const [path, source] of replacements) {
        const target = join(scratch.path, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    const result = await runCommandCheck({ ...session, root: scratch.path }, planned);
    return restoreCommandPaths(result, scratch.path, session.root);
}

async function checkWorkflowShape(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings = await Promise.all(
        planned.files.map(async ({ path }) => {
            const text = readText(session.cache, path);
            const lines = new LineCounter();
            const document = parseDocument(text, { lineCounter: lines });
            if (document.errors.length > 0 || !isMap(document.contents)) return [];
            const source = text.split('\n');
            const jobs = document.get('jobs', true);
            const jobHits = isMap(jobs)
                ? jobs.items.flatMap(({ key, value }) => (isScalar(key) && isMap(value) ? listJobHits(key, value) : []))
                : [];
            const workflow = document as Document & { contents: YAMLMap };
            const downloadRuns = await listDownloadRuns(path, listRunScripts(jobs), lines);
            const shapeFindings = [...listConcurrencyHits(workflow), ...listSecretHits(workflow), ...jobHits].flatMap(
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
            return [...shapeFindings, ...downloadRuns];
        }),
    );
    return findings.flat();
}

export const GITHUB_ACTIONS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'github-actions/actionlint': { run: checkActionlint },
    'github-actions/workflow-shape': { check: checkWorkflowShape, explanations: WORKFLOW_SHAPE_EXPLANATIONS },
};
