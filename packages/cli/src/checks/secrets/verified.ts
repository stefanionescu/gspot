import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runBinary } from '#cli/platform/spawn.ts';
import { pushBase } from '#cli/repository/staged.ts';
import { gitBlobs } from '#cli/repository/snapshot.ts';
import type { CheckResult } from '#cli/types/reports.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import type { Session, PlannedCheck } from '#cli/types/execution.ts';
import { runToolCheck, runToolCommand } from '#cli/run/tool-runner.ts';
import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';

/**
 * Supply selected changed blobs and commit metadata to TruffleHog's native JSON enumerator.
 * @param session
 * @param planned
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
    let commits = planned.commits;
    if (commits === undefined) {
        const listed = await runToolCommand(
            planned.scope.view,
            ['git', 'rev-list', `${await pushBase(session.root, session.cancelSignal)}..HEAD`, '--'],
            { cwd: session.root },
            session.cancelSignal,
        );
        if (listed.code !== 0)
            return { ...base, status: 'error', note: 'Cannot select commits for verified secret scanning.' };
        commits = listed.stdout.split('\n').filter(Boolean);
    }
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const scratch = mkdtempSync(join(tmpdir(), 'gspot-verified-secrets-'));
    try {
        const input = join(scratch, 'commits.jsonl');
        writeFileSync(input, '', { mode: 0o600 });
        for (const commit of commits) {
            const observed = await runBinary(
                [
                    'git',
                    'diff-tree',
                    '--root',
                    '--no-commit-id',
                    '--raw',
                    '-z',
                    '--no-renames',
                    '-r',
                    '-m',
                    '--diff-filter=AMT',
                    commit,
                    '--',
                ],
                {
                    cwd: session.root,
                    timeoutMs: 30_000,
                    ...(session.cancelSignal === undefined ? {} : { cancelSignal: session.cancelSignal }),
                },
            );
            if (observed.code !== 0)
                throw new SelectionError(['Cannot read the changed objects for verified secret scanning.']);
            const bytes = Buffer.from(observed.stdout);
            const text = bytes.toString('utf8');
            if (!Buffer.from(text).equals(bytes)) throw new SelectionError(['History paths must be valid UTF-8.']);
            const fields = text.split('\0');
            if (fields.pop() !== '') throw new SelectionError(['Git returned an incomplete history change list.']);
            const entries = new Map<string, string>();
            for (let position = 0; position < fields.length; position += 2) {
                const match =
                    /^:[0-7]{6} (100644|100755|120000) (?:[a-f0-9]{40}|[a-f0-9]{64}) ([a-f0-9]{40}|[a-f0-9]{64}) [AMT]$/u.exec(
                        fields[position] ?? '',
                    );
                const file = fields[position + 1];
                const object = match?.[2];
                if (object === undefined || file === undefined)
                    throw new SelectionError(['Git returned an unsupported history object.']);
                entries.set(file, object);
            }
            const blobs = await gitBlobs(session.root, [...entries.values()], session.cancelSignal);
            for (const [file, object] of entries) {
                const data = blobs.get(object);
                if (data === undefined) throw new SelectionError(['A selected history blob is missing.']);
                appendFileSync(
                    input,
                    JSON.stringify({ metadata: { commit, file }, data_b64: data.toString('base64') }) + '\n',
                );
            }
            const message = await runToolCommand(
                planned.scope.view,
                ['git', 'show', '--no-patch', '--no-show-signature', '--format=%an%n%ae%n%cn%n%ce%n%B', commit, '--'],
                { cwd: session.root },
                session.cancelSignal,
            );
            if (message.code !== 0)
                throw new SelectionError(['Cannot read selected commit metadata for verified secret scanning.']);
            appendFileSync(input, JSON.stringify({ metadata: { commit, file: '' }, data: message.stdout }) + '\n');
        }
        const result = await runToolCheck(session, planned, [
            'trufflehog',
            'json-enumerator',
            input,
            '--results=verified',
            '--json',
            '--fail',
            '--fail-on-scan-errors',
            '--no-update',
        ]);
        return { ...result, duration: performance.now() - started };
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
