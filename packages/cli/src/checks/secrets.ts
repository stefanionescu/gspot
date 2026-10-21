import { posix } from 'node:path';
import { GspotError } from '#cli/system/errors.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import { parseSource } from '#cli/parsers/grammars.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { runCheckCommand } from '#cli/runs/command/check.ts';
import { readPythonEnvironment } from '#cli/parsers/python.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import { readJavascriptEnvironment } from '#cli/parsers/typescript.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import { type Session, type PlannedCheck } from '#cli/types/planning.ts';
import { type Finding, type CheckResult } from '#cli/types/runs/check.ts';
import { getSiblingCommand, runOverPushedCommits } from '#cli/runs/commits.ts';

import {
    ENV_KEY_LINE,
    GITLEAKS_LOG_FLAG,
    ENV_READ_LANGUAGES,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    GITLEAKS_STAGED_CHECK,
} from '#cli/config/checks/secrets.ts';

async function readEnvironmentReferences(
    session: Session,
    path: string,
    readers: string[],
): Promise<EnvironmentRead[]> {
    const text = readCachedText(session.reads, path);
    if (!path.endsWith('.py')) return readJavascriptEnvironment(path, text, readers);
    const tree = await parseSource('python', text, session);
    try {
        return readPythonEnvironment(tree.rootNode, readers);
    } finally {
        tree.delete();
    }
}

function findMissingEnvironmentKeys(
    planned: PlannedCheck,
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
 * Scans each pushed commit with Gitleaks, so a secret removed before the last commit still shows.
 *
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
 * Reports environment reads that no env example lists, or skips the check without an env example.
 *
 * @param session the repository and its tools.
 * @param planned the scope to check.
 * @returns the findings.
 */
export async function checkSecretsEnvExamples(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const { env_examples: names, environment_functions: readers } = getTable(planned.selection.view, 'secrets');
    const examples = planned.files.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new GspotError(
            'skip',
            `No example environment file exists in ${planned.selection.scope.path === '' ? 'the repository root' : planned.selection.scope.path}. Declare the example environment files under secrets.env_examples.`,
        );
    const known = new Set(
        examples.flatMap((file) => {
            const lines = readCachedText(session.reads, file.path).split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const extensions = listTaggedExtensions(...ENV_READ_LANGUAGES);
    const candidates = planned.files.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
    const findings: Finding[] = [];
    for (const file of candidates) {
        const reads = await readEnvironmentReferences(session, file.path, readers);
        findings.push(...findMissingEnvironmentKeys(planned, file.path, reads, known));
    }
    return findings;
}
