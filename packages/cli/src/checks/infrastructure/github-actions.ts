import { join, posix } from 'node:path';
import { createCopy } from '#cli/runs/copy/files.ts';
import { type Session } from '#cli/types/session.ts';
import { PRIVATE_FILE } from '#cli/config/files/modes.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { type CheckResult } from '#cli/types/runs/check.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { GIT_FOLDER } from '#cli/config/repository/files/tracked.ts';
import { isMap, isSeq, isAlias, isScalar, type Scalar, parseDocument, type Document } from 'yaml';

import {
    ACTION_FILES,
    GITHUB_FOLDER,
    SELF_REPOSITORY_MARKER,
} from '#cli/config/checks/infrastructure/github-actions.ts';

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
 *
 * @param text a workflow or action file.
 * @returns the text with local paths, at the same offsets.
 */
function prepareActionlintText(text: string): string {
    const document = parseDocument(text, { keepSourceTokens: true });
    if (document.errors.length > 0 || !isMap(document.contents)) return text;
    let prepared = text;
    for (const value of listWorkflowReferences(document)) {
        const reference = isAlias(value) ? value.resolve(document) : value;
        if (!isScalar(reference) || typeof reference.value !== 'string' || !reference.value.startsWith('$/')) continue;
        prepared = replaceReference(prepared, reference);
    }
    return prepared;
}

/**
 * Runs actionlint. If a workflow or action uses a $/ reference, checks a copy with that reference changed to ./.
 *
 * @param session the repository and its tools.
 * @param planned the actionlint check and its files.
 * @returns the check result.
 */
export async function checkGithubActionsActionlint(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const replacements = new Map<string, string>();
    const actionFiles = new Map(
        [
            ...planned.files,
            ...session.repository.files.filter((file) => ACTION_FILES.includes(posix.basename(file.path))),
        ].map((file) => [file.path, file]),
    );
    for (const file of actionFiles.values()) {
        const source = readCachedText(session.reads, file.path);
        const prepared = prepareActionlintText(source);
        if (prepared !== source) replacements.set(file.path, prepared);
    }
    if (replacements.size === 0) return runCheckCommand(session, planned);
    using scratch = await createCopy({
        root: session.root,
        paths: session.repository.files.filter((file) => file.path.startsWith(GITHUB_FOLDER)).map((file) => file.path),
        dependencies: [],
        cancelSignal: session.cancelSignal,
    });
    // Actionlint discovers local reusable workflows only inside a Git project.
    mkdirSync(join(scratch.path, GIT_FOLDER));
    for (const [path, source] of replacements) {
        const target = join(scratch.path, path);
        chmodSync(target, PRIVATE_FILE);
        writeFileSync(target, source);
    }
    return await runCheckCommand(session, planned, { copyRoot: scratch.path });
}
