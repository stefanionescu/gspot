import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gitText } from '#cli/system/git.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/system/files/reads.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import { fileBatches } from '#cli/execution/command/batches.ts';
import { runCheckCommand } from '#cli/execution/command/check.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { mergeRuns, historyResult } from '#cli/checks/general/history.ts';
import type { Manifest, CheckDeclaration } from '#cli/types/configurations.ts';
import { readPushBase, pushedCommits } from '#cli/repository/revisions/changes.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';

import {
    ENV_KEY_LINE,
    TRUFFLEHOG_FLAGS,
    ENV_READ_PATTERNS,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    TRUFFLEHOG_ENUMERATOR,
    GITLEAKS_STAGED_CHECK,
} from '#cli/config/checks/general/secrets.ts';

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
 * Scan the selected Git range with TruffleHog.
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
    const head = await gitText(session.root, ['rev-parse', 'HEAD'], { cancelSignal: session.cancelSignal });
    const since = planned.base ?? (await readPushBase(session.root, session.cancelSignal));
    const result = await runCheckCommand(session, planned, {
        command: [
            ...TRUFFLEHOG_ENUMERATOR,
            pathToFileURL(session.root).href,
            '--branch',
            head.trim(),
            '--since-commit',
            since,
            ...TRUFFLEHOG_FLAGS,
        ],
    });
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
    const examples = inScope.filter((file) => names.includes(posix.basename(file.path)));
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
