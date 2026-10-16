import { join, posix } from 'node:path';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { GIT_FOLDER } from '#cli/config/repository/tracked.ts';
import { copyIntoScratch } from '#cli/execution/copy/scratch.ts';
import { type CheckResult } from '#cli/types/execution/check.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { isMap, isSeq, isAlias, isScalar, type Scalar, parseDocument, type Document } from 'yaml';
import { ACTION_FILE, SELF_REPOSITORY_MARKER } from '#cli/config/checks/infrastructure/github-actions.ts';

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
    const replaced = source.replace(
        SELF_REPOSITORY_MARKER,
        (_, prefix: string, marker: string) => prefix + (marker === '$' ? '.' : marker.replace(/24$/u, '2e')),
    );
    return text.slice(0, start) + replaced + text.slice(start + source.length);
}

/**
 * Converts self-repository references to local paths for the pinned actionlint parser, preserving offsets.
 * @param text a workflow or action file.
 * @returns the text with each self-repository marker of a reference turned into a local path, at the same offsets.
 */
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
 * Runs actionlint. If a workflow or action uses a $/ reference, checks a temporary copy with that reference changed to ./.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function actionlint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const replacements = new Map<string, string>();
    const inputs = new Map(
        [...planned.files, ...session.repository.files.filter((file) => posix.basename(file.path) === ACTION_FILE)].map(
            (file) => [file.path, file],
        ),
    );
    for (const file of inputs.values()) {
        const source = readCachedBytes(session.reads, file.path).toString('utf8');
        const prepared = actionlintSource(source);
        if (prepared !== source) replacements.set(file.path, prepared);
    }
    if (replacements.size === 0)
        return runCheckCommand(session, planned, { command: planned.check.command as string[] });
    using workspace = await copyIntoScratch({
        root: session.root,
        paths: session.repository.files.filter((file) => file.path.startsWith('.github/')).map((file) => file.path),
        dependencies: [],
    });
    // Actionlint discovers local reusable workflows only inside a Git project.
    mkdirSync(join(workspace.path, GIT_FOLDER));
    for (const [path, source] of replacements) {
        const target = join(workspace.path, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    return await runCheckCommand(session, planned, {
        command: planned.check.command as string[],
        scratchRoot: workspace.path,
    });
}
