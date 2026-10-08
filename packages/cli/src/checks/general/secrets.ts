import { join } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/platform/public.ts';
import { decodeUtf8 } from '#cli/platform/contracts.ts';
import { writeFileSync, appendFileSync } from 'node:fs';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { isInScope } from '#cli/repository/paths/public.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { isEnvironmentFile } from '#cli/repository/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import { runCheckCommand } from '#cli/execution/command/public.ts';
import { runGit, runGitBinary } from '#cli/platform/git/public.ts';
import type { SecretScan } from '#cli/types/checks/general/secrets.ts';
import { extensionsTagged } from '#cli/repository/discovery/contracts.ts';
import { fileBatches } from '#cli/execution/command/arguments/contracts.ts';
import { getBlobs, getPushBase } from '#cli/repository/revisions/public.ts';
import type { CheckInput, CheckResult } from '#cli/types/execution/check.ts';

import {
    DIFF_TREE,
    CHANGE_LINE,
    ENV_KEY_LINE,
    COMMIT_METADATA,
    ENV_READ_PATTERNS,
    RAW_CHANGE_FIELDS,
    GITLEAKS_LOG_OPTIONS,
} from '#cli/config/checks/general/secrets.ts';

// The commits under review: the ones the run supplies, or every commit after the push base.
async function scannedCommits(session: ToolSession, planned: PlannedCheck): Promise<string[] | undefined> {
    if (planned.commits !== undefined) return planned.commits;
    const base = await getPushBase(session.root, session.cancelSignal);
    const listed = await runGit(session.root, ['rev-list', `${base}..HEAD`, '--'], {
        cancelSignal: session.cancelSignal,
    });
    return listed.code === 0 ? listed.stdout.split('\n').filter(Boolean) : undefined;
}

// The NUL-separated fields of a commit's raw change list, which must be UTF-8 and complete.
async function changeFields(session: ToolSession, commit: string): Promise<string[]> {
    const read = await runGitBinary(session.root, [...DIFF_TREE, commit, '--'], { cancelSignal: session.cancelSignal });
    if (read.code !== 0) throw new Error('Cannot read the changed objects for verified secret scanning.');
    const text = decodeUtf8(read.stdout);
    if (text === undefined) throw new Error('History paths must be valid UTF-8.');
    const fields = text.split('\0');
    if (fields.pop() !== '') throw new Error('Git returned an incomplete history change list.');
    return fields;
}

// The blob each changed file holds after the commit, by path.
function changedObjects(fields: string[]): Map<string, string> {
    const entries = new Map<string, string>();
    for (let position = 0; position < fields.length; position += RAW_CHANGE_FIELDS) {
        const blobId = CHANGE_LINE.exec(fields[position] ?? '')?.[2];
        const file = fields[position + 1];
        if (blobId === undefined || file === undefined) throw new Error('Git returned an unsupported history object.');
        entries.set(file, blobId);
    }
    return entries;
}

// Appends every changed blob of a commit to the enumerator input.
async function appendBlobs(scan: SecretScan, commit: string): Promise<void> {
    const entries = changedObjects(await changeFields(scan.session, commit));
    const blobs = await getBlobs(scan.session.root, [...entries.values()], scan.session.cancelSignal);
    for (const [file, blobId] of entries) {
        const blob = blobs.get(blobId);
        if (blob === undefined) throw new Error('A selected history blob is missing.');
        appendFileSync(
            scan.enumeratorFile,
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
    if (commitResult.code !== 0) throw new Error('Cannot read selected commit metadata for verified secret scanning.');
    appendFileSync(
        scan.enumeratorFile,
        `${JSON.stringify({ metadata: { commit, file: '' }, data: commitResult.stdout })}\n`,
    );
}

// Writes the enumerator input for every commit, then runs TruffleHog over it.
async function scanCommits(session: ToolSession, planned: PlannedCheck, commits: string[]): Promise<CheckResult> {
    using folder = scratchFolder('gspot-verified-secrets-');
    const scratch = folder.path;
    const scan: SecretScan = { session, enumeratorFile: join(scratch, 'commits.jsonl') };
    writeFileSync(scan.enumeratorFile, '', { mode: PRIVATE_FILE });
    for (const commit of commits) {
        await appendBlobs(scan, commit);
        await appendMetadata(scan, commit);
    }
    return await runCheckCommand(session, planned, {
        command: [
            'trufflehog',
            'json-enumerator',
            scan.enumeratorFile,
            '--results=verified',
            '--json',
            '--fail',
            '--fail-on-scan-errors',
            '--no-update',
        ],
    });
}

/**
 * Scan the exact selected commits, including secrets removed before the final pushed tree.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function gitleaksPushed(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const result: CheckResult = {
        check: planned.check.name,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: 0,
        findings: [],
        duration: 0,
    };
    if (!session.repository.hasGit)
        return { ...result, status: 'skipped', note: 'Secret history requires a Git repository.' };
    const command = [
        'gitleaks',
        'git',
        '--no-banner',
        '--redact',
        '--exit-code',
        '1',
        '--config',
        '{tool_file:gitleaks}',
        '--report-format',
        'json',
        '--report-path',
        '-',
        '{root}',
    ];
    let selections: string[] = [];
    if (planned.commits === undefined) selections = [`${await getPushBase(session.root, session.cancelSignal)}..HEAD`];
    else if (planned.commits.length > 0)
        selections = fileBatches(
            planned.commits,
            [...command, '--log-opts', GITLEAKS_LOG_OPTIONS],
            process.platform,
        ).map((commits) => `${GITLEAKS_LOG_OPTIONS} ${commits.join(' ')} --`);
    for (const selection of selections) {
        const current = await runCheckCommand(session, planned, { command: [...command, '--log-opts', selection] });
        result.findings.push(...current.findings);
        if (current.status === 'missing' || current.status === 'error')
            return { ...current, findings: result.findings, duration: performance.now() - started };
        if (current.status === 'failed') result.status = 'failed';
    }
    return { ...result, duration: performance.now() - started };
}

/**
 * One finding for each tracked environment file that is not a template.
 * @param input the check input
 * @returns the findings
 */
export function envFiles(input: CheckInput): Finding[] {
    const tracked = [...new Set(input.index.map((entry) => entry.path))];
    return tracked
        .filter(isEnvironmentFile)
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'tracked-env',
                `${path} is tracked; an environment file holds the values of one machine.`,
            ),
        );
}

/**
 * Supply selected changed blobs and commit metadata to TruffleHog's native JSON enumerator.
 * @param session the open session
 * @param planned the planned check
 * @returns the check result
 */
export async function trufflehog(session: ToolSession, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const base: CheckResult = {
        check: planned.check.name,
        scope: planned.scope.scope.path,
        status: 'passed',
        fileCount: 0,
        findings: [],
        duration: 0,
    };
    if (!session.repository.hasGit)
        return { ...base, status: 'skipped', note: 'Verified secret history requires a Git repository.' };
    const commits = await scannedCommits(session, planned);
    if (commits === undefined)
        return { ...base, status: 'error', note: 'Cannot select commits for verified secret scanning.' };
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const result = await scanCommits(session, planned, commits);
    return { ...result, duration: performance.now() - started };
}

/**
 * Reports supported environment reads missing from example environment files, or the absent example prerequisite.
 * @param input the check input
 * @returns the findings
 */
export function envTemplate(input: CheckInput): Finding[] {
    const { env_examples: names, reader_functions: readers } = input.view.options('secrets');
    // The owned files are configuration; the reads are in code, so the whole scope is inspected.
    const inScope = input.files.filter((file) => isInScope(file.path, input.scope));
    const examples = inScope.filter((file) => names.includes(file.path));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${input.scope === '' ? 'the repository root' : input.scope}. Declare the example environment files under secrets.env_examples.`,
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
    const extensions = extensionsTagged('javascript', 'typescript', 'python', 'vue', 'svelte', 'astro');
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
