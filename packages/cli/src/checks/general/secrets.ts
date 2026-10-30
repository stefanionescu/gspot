import { posix } from 'node:path';
import { read } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildBaseResult } from '#cli/runs/results.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { runCommandCheck } from '#cli/runs/command/check.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { readPushedRange } from '#cli/repository/revisions/push.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import type { EnvironmentRead } from '#cli/types/parsers/code/environment.ts';
import { type CheckResult, type CheckFinding } from '#cli/types/runs/check.ts';
import { getSiblingCommand, listPushedCommits } from '#cli/checks/cross-configuration/pushed-commits.ts';
import { listPythonEnvironmentReads, listJavascriptEnvironmentReads } from '#cli/parsers/code/environment.ts';

import {
    ENV_KEY_LINE,
    MISSING_KEY_RULE,
    GITLEAKS_LOG_FLAG,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    GITLEAKS_STAGED_CHECK,
    ENVIRONMENT_READ_LANGUAGES,
} from '#cli/config/checks/general/secrets.ts';

async function readEnvironmentReferences(
    session: Session,
    path: string,
    environmentFunctions: string[],
): Promise<EnvironmentRead[]> {
    const text = read(session.reads, path);
    if (!path.endsWith(PYTHON_EXTENSION)) return listJavascriptEnvironmentReads(path, text, environmentFunctions);
    using tree = await parseSource('python', text, session);
    return listPythonEnvironmentReads(tree.rootNode, environmentFunctions);
}

function listMissingEnvironmentKeys(
    path: string,
    environmentReads: EnvironmentRead[],
    exampleKeys: Set<string>,
): CheckFinding[] {
    const findings: CheckFinding[] = [];
    const seen = new Set<string>();
    const ordered = environmentReads.toSorted(
        (left, right) => left.line - right.line || compareText(left.key ?? '', right.key ?? ''),
    );
    for (const { key, line } of ordered) {
        if (key === undefined || exampleKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        findings.push({
            file: path,
            line,
            rule: MISSING_KEY_RULE,
            message: `${key} is read here and appears in no example environment file.`,
        });
    }
    return findings;
}

/**
Scans each pushed commit with Gitleaks, so a secret removed before the last commit still shows.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSecretsGitleaksPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const command = getSiblingCommand(planned, GITLEAKS_STAGED_CHECK).filter(
        (argument) => argument !== GITLEAKS_STAGED_FLAG,
    );
    const commits = await listPushedCommits(session, planned);
    if (!Array.isArray(commits)) return commits;
    if (commits.length === 0) return buildBaseResult(planned, session);
    const range = planned.range ?? (await readPushedRange(session.toolsRoot, session.cancelSignal));
    return runCommandCheck(session, planned, {
        command: [...command, GITLEAKS_LOG_FLAG, `${GITLEAKS_LOG_OPTIONS} ${range.join(' ')} --`],
    });
}

/**
Reports each environment variable that the code reads and no example environment file lists, or skips the check when
the scope has no example environment file.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSecretsEnvExamples(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { env_examples: names, environment_functions: environmentFunctions } = getTable(
        planned.scope.settings,
        'secrets',
    );
    const examples = planned.files.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${planned.scope.path === '' ? 'the repository root' : planned.scope.path}. List the example environment files in secrets.env_examples.`,
        );
    const exampleKeys = new Set(
        examples.flatMap((file) => {
            const lines = read(session.reads, file.path).split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const extensions = listTaggedExtensions(...ENVIRONMENT_READ_LANGUAGES);
    const sourceFiles = planned.files.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    const findings: CheckFinding[] = [];
    for (const file of sourceFiles) {
        const reads = await readEnvironmentReferences(session, file.path, environmentFunctions);
        findings.push(...listMissingEnvironmentKeys(file.path, reads, exampleKeys));
    }
    return findings;
}
