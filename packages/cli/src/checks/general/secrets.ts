import { posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readGitText } from '#cli/system/git.ts';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/system/errors.ts';
import { isInScope } from '#cli/repository/scopes.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { readPythonEnvironment } from '#cli/parsers/python.ts';
import { runCheckCommand } from '#cli/checks/run/command/check.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import { readJavascriptEnvironment } from '#cli/parsers/typescript.ts';
import { type EnvironmentRead } from '#cli/types/parsers/environment.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { readPushBase, readPushedCommits } from '#cli/repository/revisions/push.ts';
import { type Finding, type CheckInput, type CheckResult } from '#cli/types/execution/check.ts';
import { historyResult, siblingCommand, runOverPushedCommits } from '#cli/checks/general/pushed-commits.ts';

import {
    ENV_KEY_LINE,
    TRUFFLEHOG_FLAGS,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    TRUFFLEHOG_ENUMERATOR,
    GITLEAKS_STAGED_CHECK,
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
            findingAt(
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
 * Scan the exact selected commits, including secrets removed before the final pushed tree.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function gitleaksPushed(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const command = siblingCommand(planned, GITLEAKS_STAGED_CHECK).filter(
        (argument) => argument !== GITLEAKS_STAGED_FLAG,
    );
    return runOverPushedCommits(session, planned, (commit) =>
        runCheckCommand(session, planned, {
            command: [...command, GITLEAKS_LOG_FLAG, `${GITLEAKS_LOG_OPTIONS} ${commit} --`],
        }),
    );
}

/**
 * Scan the selected Git range with TruffleHog.
 * @param session the open session.
 * @param planned the planned check.
 * @returns the check result.
 */
export async function trufflehog(session: Session, planned: PlannedCheck): Promise<CheckResult> {
    const started = performance.now();
    const base = historyResult(session, planned);
    if (base.status === 'skipped') return base;
    const commits = await readPushedCommits(session.root, planned.commits, session.cancelSignal);
    if (!Array.isArray(commits)) return { ...base, status: 'error', note: commits.error };
    if (commits.length === 0) return { ...base, note: 'No selected commits to scan.' };
    const head = await readGitText(session.root, ['rev-parse', 'HEAD'], { cancelSignal: session.cancelSignal });
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
export async function envExamples(input: CheckInput): Promise<Finding[]> {
    const { env_examples: names, reader_functions: readers } = input.scope.view.options('secrets');
    // Example files list variable names; reads appear in code, so inspect the whole scope.
    const inScope = input.files.filter((file) => isInScope(file.path, input.scope.scope.path));
    const examples = inScope.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${input.scope.scope.path === '' ? 'the repository root' : input.scope.scope.path}. Declare the example environment files under secrets.env_examples.`,
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
