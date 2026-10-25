import { posix } from 'node:path';
import { compareText } from '#cli/system/text.ts';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/checks/finding.ts';
import { type PlannedCheck } from '#cli/types/planning.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code/python.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import type { EnvironmentRead } from '#cli/types/parsers/code/environment.ts';
import { getSiblingCommand, runOverPushedCommits } from '#cli/checks/pushed-commits.ts';
import { listPythonEnvironmentReads, listJavascriptEnvironmentReads } from '#cli/parsers/code/environment.ts';

import {
    ENV_KEY_LINE,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    GITLEAKS_STAGED_CHECK,
} from '#cli/config/checks/general/secrets.ts';

async function readEnvironmentReferences(
    session: Session,
    path: string,
    environmentFunctions: string[],
): Promise<EnvironmentRead[]> {
    const text = readCachedText(session.reads, path);
    if (!path.endsWith(PYTHON_EXTENSION)) return listJavascriptEnvironmentReads(path, text, environmentFunctions);
    const tree = await parseSource('python', text, session);
    try {
        return listPythonEnvironmentReads(tree.rootNode, environmentFunctions);
    } finally {
        tree.delete();
    }
}

function listMissingEnvironmentKeys(
    planned: PlannedCheck,
    path: string,
    reads: EnvironmentRead[],
    exampleKeys: Set<string>,
): Finding[] {
    const findings: Finding[] = [];
    const seen = new Set<string>();
    const ordered = reads.toSorted(
        (left, right) => left.line - right.line || compareText(left.key ?? '', right.key ?? ''),
    );
    for (const { key, line } of ordered) {
        if (key === undefined || exampleKeys.has(key) || seen.has(key)) continue;
        seen.add(key);
        findings.push(
            buildFinding(
                planned,
                { file: path, line },
                'missing-key',
                `${key} is read here and appears in no example environment file.`,
            ),
        );
    }
    return findings;
}

/**
Scans each pushed commit with Gitleaks, so a secret removed before the last commit still shows.

@param session the repository and its tools.
@param planned the Gitleaks check and commit range.
@returns the check result.
*/
export async function checkSecretsGitleaksPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
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
Reports each environment variable that the code reads and no example environment file lists, or skips the check when
the scope has no example environment file.

@param session the repository and its tools.
@param planned the scope to check.
@returns the findings.
*/
export async function checkSecretsEnvExamples(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const { env_examples: names, environment_functions: environmentFunctions } = getTable(
        planned.scope.settings,
        'secrets',
    );
    const examples = planned.files.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${planned.scope.folder.path === '' ? 'the repository root' : planned.scope.folder.path}. List the example environment files in secrets.env_examples.`,
        );
    const exampleKeys = new Set(
        examples.flatMap((file) => {
            const lines = readCachedText(session.reads, file.path).split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const extensions = listTaggedExtensions(...ENV_READ_LANGUAGES);
    const sourceFiles = planned.files.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    const findings: Finding[] = [];
    for (const file of sourceFiles) {
        const reads = await readEnvironmentReferences(session, file.path, environmentFunctions);
        findings.push(...listMissingEnvironmentKeys(planned, file.path, reads, exampleKeys));
    }
    return findings;
}
