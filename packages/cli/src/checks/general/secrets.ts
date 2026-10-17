import { posix } from 'node:path';
import { readGitText } from '#cli/system/git.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { readPythonEnvironment } from '#cli/parsers/python.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import { readJavascriptEnvironment } from '#cli/parsers/typescript.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { readPushBase, readPushedCommits } from '#cli/repository/revisions/push.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/checks/run/check.ts';
import { getSiblingCommand, buildHistoryResult, runOverPushedCommits } from '#cli/checks/general/pushed-commits.ts';

import {
    ENV_KEY_LINE,
    TRUFFLEHOG_FLAGS,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    GITLEAKS_STAGED_CHECK,
    TRUFFLEHOG_GIT_COMMAND,
} from '#cli/config/checks/general/secrets.ts';

async function readEnvironmentReferences(
    input: CheckInput,
    path: string,
    readers: string[],
): Promise<EnvironmentRead[]> {
    const text = readCachedBytes(input.reads, path).toString('utf8');
    if (!path.endsWith('.py')) return readJavascriptEnvironment(path, text, readers);
    const tree = await parseSource('python', text, input);
    try {
        return readPythonEnvironment(tree.rootNode, readers);
    } finally {
        tree.delete();
    }
}

function findMissingEnvironmentKeys(
    input: CheckInput,
    path: string,
    reads: EnvironmentRead[],
    known: Set<string>,
): Finding[] {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    for (const { key, line } of reads.toSorted(
        (left, right) => left.line - right.line || (left.key ?? '').localeCompare(right.key ?? ''),
    )) {
        if (key === undefined || known.has(key) || seen.has(key)) continue;
        seen.add(key);
        findings.push(
            buildFinding(
                input,
                { file: path, line },
                'missing-key',
                `${key} is read here and appears in no example environment file.`,
            ),
        );
    }
    return findings;
}

/**
 * Scans each pushed commit with Gitleaks, so a secret removed before the last commit still shows.
 * @param session the repository and its tools.
 * @param planned the Gitleaks check and commit range.
 * @returns the check result.
 */
export async function checkSecretsGitleaksPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = getSiblingCommand(planned, GITLEAKS_STAGED_CHECK).filter(
        (argument) => argument !== GITLEAKS_STAGED_FLAG,
    );
    return runOverPushedCommits(session, planned, (commit) =>
        runCheckCommand(session, planned, {
            command: [...command, GITLEAKS_LOG_FLAG, `${GITLEAKS_LOG_OPTIONS} ${commit} --`],
        }),
    );
}

/**
 * Scans the pushed commits with TruffleHog.
 * @param session the repository and its tools.
 * @param planned the TruffleHog check and commit range.
 * @returns the check result.
 */
export async function checkSecretsTrufflehogPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const base = buildHistoryResult(session, planned);
    if (base.status === 'skipped') return base;
    const commits = await readPushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...base, status: 'error', note: commits.error };
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const head = await readGitText(session.root, ['rev-parse', 'HEAD'], { cancelSignal: session.cancelSignal });
    const since = planned.base ?? (await readPushBase(session.root, session.cancelSignal));
    const result = await runCheckCommand(session, planned, {
        command: [...TRUFFLEHOG_GIT_COMMAND, '--branch', head.trim(), '--since-commit', since, ...TRUFFLEHOG_FLAGS],
    });
    return { ...result, duration: performance.now() - started };
}

/**
 * Reports environment reads that no env example lists, or skips the check without an env example.
 * @param input the scope to check.
 * @returns the findings.
 */
export async function checkSecretsEnvExamples(input: CheckInput): Promise<Finding[]> {
    const { env_examples: names, environment_functions: readers } = input.selection.view.options('secrets');
    // Env examples list the names, and code anywhere in the scope reads them.
    const inScope = input.files.filter((file) => isInScope(file.path, input.selection.scope.path));
    const examples = inScope.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${input.selection.scope.path === '' ? 'the repository root' : input.selection.scope.path}. Declare the example environment files under secrets.env_examples.`,
        );
    const known = new Set(
        examples.flatMap((file) => {
            const lines = readCachedBytes(input.reads, file.path).toString('utf8').split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const extensions = listTaggedExtensions(...ENV_READ_LANGUAGES);
    const candidates = inScope.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    const findings: Finding[] = [];
    for (const file of candidates) {
        const reads = await readEnvironmentReferences(input, file.path, readers);
        findings.push(...findMissingEnvironmentKeys(input, file.path, reads, known));
    }
    return findings;
}
