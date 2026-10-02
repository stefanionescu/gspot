// Verified secret scanning over pushed history: each changed blob and each commit message handed to TruffleHog.
import { join } from 'node:path';
import { decodedText } from '#cli/platform/text.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { writeFileSync, appendFileSync } from 'node:fs';
import type { Session } from '#cli/types/tools/tools.ts';
import { PRIVATE_FILE } from '#cli/config/platform/root.ts';
import { runGit, runGitBinary } from '#cli/platform/git.ts';
import { scratchFolder } from '#cli/platform/filesystem.ts';
import { runToolCheck } from '#cli/execution/tool/runner.ts';
import { gitBlobs } from '#cli/execution/checkout/revision.ts';
import { pushBase } from '#cli/repository/revisions/changes.ts';
import type { SecretScan } from '#cli/types/checks/general/secrets.ts';
import type { CheckResult, PlannedCheck } from '#cli/types/execution/execution.ts';
import { DIFF_TREE, CHANGE_LINE, COMMIT_METADATA } from '#cli/config/checks/general/secrets.ts';

// The fields come as key and value pairs.
const PAIR = 2;

// The commits under review: the ones the run supplies, or every commit after the push base.
async function selectedCommits(session: Session, planned: PlannedCheck): Promise<string[] | undefined> {
    if (planned.commits !== undefined) return planned.commits;
    const base = await pushBase(session.root, session.cancelSignal);
    const listed = await runGit(session.root, ['rev-list', `${base}..HEAD`, '--'], {
        cancelSignal: session.cancelSignal,
    });
    return listed.code === 0 ? listed.stdout.split('\n').filter(Boolean) : undefined;
}

// The NUL-separated fields of a commit's raw change list, which must be UTF-8 and complete.
async function changeFields(session: Session, commit: string): Promise<string[]> {
    const read = await runGitBinary(session.root, [...DIFF_TREE, commit, '--'], { cancelSignal: session.cancelSignal });
    if (read.code !== 0)
        throw new GspotError('selection', ['Cannot read the changed objects for verified secret scanning.']);
    const text = decodedText(read.stdout);
    if (text === undefined) throw new GspotError('selection', ['History paths must be valid UTF-8.']);
    const fields = text.split('\0');
    if (fields.pop() !== '') throw new GspotError('selection', ['Git returned an incomplete history change list.']);
    return fields;
}

// The blob each changed file holds after the commit, by path.
function changedObjects(fields: string[]): Map<string, string> {
    const entries = new Map<string, string>();
    for (let position = 0; position < fields.length; position += PAIR) {
        const blobId = CHANGE_LINE.exec(fields[position] ?? '')?.[2];
        const file = fields[position + 1];
        if (blobId === undefined || file === undefined)
            throw new GspotError('selection', ['Git returned an unsupported history object.']);
        entries.set(file, blobId);
    }
    return entries;
}

// Appends every changed blob of a commit to the enumerator input.
async function appendBlobs(scan: SecretScan, commit: string): Promise<void> {
    const entries = changedObjects(await changeFields(scan.session, commit));
    const blobs = await gitBlobs(scan.session.root, [...entries.values()], scan.session.cancelSignal);
    for (const [file, blobId] of entries) {
        const blob = blobs.get(blobId);
        if (blob === undefined) throw new GspotError('selection', ['A selected history blob is missing.']);
        appendFileSync(
            scan.input,
            `${JSON.stringify({ metadata: { commit, file }, data_b64: blob.toString('base64') })}\n`,
        );
    }
}

// Appends a commit's author, committer, and message to the enumerator input.
async function appendMetadata(scan: SecretScan, commit: string): Promise<void> {
    const { session } = scan;
    const commitResult = await runGit(session.root, [...COMMIT_METADATA, commit, '--'], {
        cancelSignal: session.cancelSignal,
    });
    if (commitResult.code !== 0)
        throw new GspotError('selection', ['Cannot read selected commit metadata for verified secret scanning.']);
    appendFileSync(scan.input, `${JSON.stringify({ metadata: { commit, file: '' }, data: commitResult.stdout })}\n`);
}

// Writes the enumerator input for every commit, then runs TruffleHog over it.
async function scanCommits(session: Session, planned: PlannedCheck, commits: string[]): Promise<CheckResult> {
    using folder = scratchFolder('gspot-verified-secrets-');
    const scratch = folder.path;
    const scan: SecretScan = { session, planned, input: join(scratch, 'commits.jsonl') };
    writeFileSync(scan.input, '', { mode: PRIVATE_FILE });
    for (const commit of commits) {
        await appendBlobs(scan, commit);
        await appendMetadata(scan, commit);
    }
    return await runToolCheck(session, planned, [
        'trufflehog',
        'json-enumerator',
        scan.input,
        '--results=verified',
        '--json',
        '--fail',
        '--fail-on-scan-errors',
        '--no-update',
    ]);
}

/**
 * Supply selected changed blobs and commit metadata to TruffleHog's native JSON enumerator.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function checkVerifiedSecrets(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const base: CheckResult = {
        check: planned.check,
        scope: planned.scope.scope.path,
        status: 'ok',
        files: 0,
        findings: [],
        duration: 0,
    };
    if (!session.repository.hasGit)
        return { ...base, status: 'skipped', note: 'Verified secret history requires a Git repository.' };
    const commits = await selectedCommits(session, planned);
    if (commits === undefined)
        return { ...base, status: 'error', note: 'Cannot select commits for verified secret scanning.' };
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const result = await scanCommits(session, planned, commits);
    return { ...result, duration: performance.now() - started };
}
