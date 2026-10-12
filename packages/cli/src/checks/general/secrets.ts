import { join } from 'node:path';
import { decodeUtf8 } from '#cli/text.ts';
import { GspotError } from '#cli/errors.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { scratchFolder } from '#cli/system/files.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/system/file-reads.ts';
import { writeFileSync, appendFileSync } from 'node:fs';
import { PRIVATE_FILE } from '#cli/config/system/modes.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import { runGit, runGitForBytes } from '#cli/system/git.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { readBlobs } from '#cli/repository/revisions/objects.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { pushedCommits } from '#cli/repository/revisions/changes.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { mergeRuns, historyResult } from '#cli/checks/general/history.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';

import {
    DIFF_TREE,
    CHANGE_LINE,
    ENV_KEY_LINE,
    COMMIT_METADATA,
    ENUMERATOR_FILE,
    TRUFFLEHOG_FLAGS,
    ENV_READ_PATTERNS,
    RAW_CHANGE_FIELDS,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    TRUFFLEHOG_ENUMERATOR,
    GITLEAKS_STAGED_CHECK,
} from '#cli/config/checks/general/secrets.ts';

// The blob each changed file holds after the commit, by path.
// eslint-disable-next-line complexity -- reason: Git change records distinguish added, removed, and renamed objects; this reader validates those forms together.
async function changedObjects(session: Session, commit: string): Promise<Map<string, string>> {
    const read = await runGitForBytes(session.root, [...DIFF_TREE, commit, '--'], {
        cancelSignal: session.cancelSignal,
    });
    if (read.code !== 0) throw new Error('Cannot read the changed files for verified secret scanning.');
    const text = decodeUtf8(read.stdout);
    if (text === undefined) throw new Error('History paths must be valid UTF-8.');
    const fields = text.split('\0');
    if (fields.pop() !== '') throw new Error('Git returned an incomplete list of changed files.');
    const entries = new Map<string, string>();
    for (let position = 0; position < fields.length; position += RAW_CHANGE_FIELDS) {
        const blobId = CHANGE_LINE.exec(fields[position] ?? '')?.[2];
        const file = fields[position + 1];
        if (blobId === undefined || file === undefined)
            throw new Error('Git returned an unsupported changed-file record.');
        entries.set(file, blobId);
    }
    return entries;
}

// Appends every changed blob of a commit to the enumerator input.
async function appendBlobs(session: Session, enumeratorFile: string, commit: string): Promise<void> {
    const entries = await changedObjects(session, commit);
    const blobs = await readBlobs(session.root, [...entries.values()], session.cancelSignal);
    for (const [index, [file]] of [...entries].entries()) {
        const blob = blobs[index] as Buffer;
        appendFileSync(
            enumeratorFile,
            `${JSON.stringify({ metadata: { commit, file }, data_b64: blob.toString('base64') })}\n`,
        );
    }
}

// Appends a commit's author, committer, and message to the enumerator input.
async function appendMetadata(session: Session, enumeratorFile: string, commit: string): Promise<void> {
    const commitResult = await runGit(session.root, [...COMMIT_METADATA, commit, '--'], {
        cancelSignal: session.cancelSignal,
    });
    if (commitResult.code !== 0) throw new Error('Cannot read selected commit metadata for verified secret scanning.');
    appendFileSync(
        enumeratorFile,
        `${JSON.stringify({ metadata: { commit, file: '' }, data: commitResult.stdout })}\n`,
    );
}

// Writes the enumerator input for every commit, then runs TruffleHog over it.
async function scanCommits(session: Session, planned: PlannedCheck, commits: string[]): Promise<CheckResult> {
    using folder = scratchFolder();
    const scratch = folder.path;
    const enumeratorFile = join(scratch, ENUMERATOR_FILE);
    writeFileSync(enumeratorFile, '', { mode: PRIVATE_FILE });
    for (const commit of commits) {
        await appendBlobs(session, enumeratorFile, commit);
        await appendMetadata(session, enumeratorFile, commit);
    }
    return await runCheckCommand(session, planned, {
        command: [...TRUFFLEHOG_ENUMERATOR, enumeratorFile, ...TRUFFLEHOG_FLAGS],
    });
}

/**
 * Scan the exact selected commits, including secrets removed before the final pushed tree.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function gitleaksPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    let result = historyResult(session, planned, 'Secret history requires a Git repository.');
    if (result.status === 'skipped') return result;
    const commits = await pushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...result, status: 'error', note: commits.error };
    const command = (
        ((planned.manifest as Manifest).checks.find(({ name }) => name === GITLEAKS_STAGED_CHECK) as CheckDeclaration)
            .command as string[]
    ).filter((argument) => argument !== GITLEAKS_STAGED_FLAG);
    const selections = fileBatches(commits, [...command, GITLEAKS_LOG_FLAG, GITLEAKS_LOG_OPTIONS], process.platform);
    for (const batch of selections) {
        const selection = `${GITLEAKS_LOG_OPTIONS} ${batch.join(' ')} --`;
        const current = await runCheckCommand(session, planned, {
            command: [...command, GITLEAKS_LOG_FLAG, selection],
        });
        result = mergeRuns([result, current]);
        if (result.status === 'missing' || result.status === 'error') break;
    }
    return { ...result, duration: performance.now() - started };
}

/**
 * Supply selected changed blobs and commit metadata to TruffleHog's JSON enumerator.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function trufflehog(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const base = historyResult(session, planned, 'Verified secret history requires a Git repository.');
    if (base.status === 'skipped') return base;
    const commits = await pushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits))
        return { ...base, status: 'error', note: 'Cannot select commits for verified secret scanning.' };
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const result = await scanCommits(session, planned, commits);
    return { ...result, duration: performance.now() - started };
}

/**
 * Reports supported environment reads missing from example environment files, or the absent example prerequisite.
 * @param input the check input.
 * @returns the findings.
 */
export function envExamples(input: CheckInput): Finding[] {
    const { env_examples: names, reader_functions: readers } = input.selection.view.options('secrets');
    // Example files list variable names; reads appear in code, so inspect the whole scope.
    const inScope = input.files.filter((file) => isInScope(file.path, input.selection.scope.path));
    const examples = inScope.filter((file) => names.includes(file.path));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${input.selection.scope.path === '' ? 'the repository root' : input.selection.scope.path}. Declare the example environment files under secrets.env_examples.`,
        );
    const known = new Set(
        examples.flatMap((file) => {
            const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const patterns = [
        ...ENV_READ_PATTERNS,
        ...readers.map(
            (reader) =>
                new RegExp(
                    String.raw`(?<![\p{ID_Continue}$.])${RegExp.escape(reader)}\(\s*['"](?<key>[A-Z][A-Z0-9_]*)['"]`,
                    'gu',
                ),
        ),
    ];
    const extensions = extensionsTagged(...ENV_READ_LANGUAGES);
    const candidates = inScope.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    return candidates.flatMap((file) => {
        const lines = readSource(input.root, file.path, input.reads).toString('utf8').split('\n');
        const seen = new Set<string>();
        return lines.flatMap((line, index) => {
            const findings: Finding[] = [];
            for (const pattern of patterns) {
                for (const match of line.matchAll(pattern)) {
                    const key = match.groups?.['key'];
                    if (key === undefined || known.has(key) || seen.has(key)) continue;
                    seen.add(key);
                    findings.push(
                        findingAt(
                            input,
                            { file: file.path, line: index + 1 },
                            'missing-key',
                            `${key} is read here and appears in no example environment file.`,
                        ),
                    );
                }
            }
            return findings;
        });
    });
}
