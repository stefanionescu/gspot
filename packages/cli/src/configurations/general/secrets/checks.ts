import { posix } from 'node:path';
import { remember } from '#cli/system/cache.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { getTable } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import { readText } from '#cli/system/files/reads.ts';
import { compareText } from '#cli/system/text/order.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { EnvironmentRead } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { PYTHON_EXTENSION } from '#cli/config/parsers/code.ts';
import { assertCommandCheck } from '#cli/engine/plan/checks.ts';
import { ROOT_FOLDER_NAME } from '#cli/config/tools/programs.ts';
import { runCommandCheck } from '#cli/engine/run/tool-runs/check.ts';
import { listTaggedExtensions } from '#cli/repository/files/tags.ts';
import { buildBaseResult, keepListedFindings } from '#cli/engine/results.ts';
import { readPushedRange, readSelectedCommits } from '#cli/repository/revisions/push.ts';
import { listEnvironmentReads, listJavascriptEnvironmentReads } from '#cli/parsers/code/environment.ts';
import type { CheckCode, CheckResult, CheckFinding, CheckSession, CheckRunOptions } from '#cli/types/engine/run.ts';

import {
    ENV_KEY_LINE,
    SECRET_KEY_NAME,
    MISSING_KEY_RULE,
    ROOT_PLACEHOLDER,
    GITLEAKS_GIT_MODE,
    GITLEAKS_LOG_FLAG,
    GITLEAKS_FILES_MODE,
    GITLEAKS_LOG_OPTIONS,
    GITLEAKS_STAGED_FLAG,
    ENVIRONMENT_DEFAULT_RULE,
    ENVIRONMENT_READ_LANGUAGES,
} from '#cli/config/configurations/secrets.ts';

const ENVIRONMENT_READS_KEY = Symbol('environment reads');

async function readEnvironmentReferences(
    session: Session,
    path: string,
    environmentFunctions: string[],
): Promise<EnvironmentRead[]> {
    const text = readText(session.cache, path);
    if (!path.endsWith(PYTHON_EXTENSION))
        return await listJavascriptEnvironmentReads(path, text, environmentFunctions, session);
    using tree = await parseSource('python', text, session);
    return listEnvironmentReads('python', tree.rootNode, { environmentFunctions, readerVariables: new Set() });
}

function listEnvironmentSources(planned: PlannedCheck): PlannedCheck['files'] {
    const extensions = listTaggedExtensions(...ENVIRONMENT_READ_LANGUAGES);
    return planned.files.filter(
        (file) => file.kind === 'source' && extensions.some((extension) => file.path.endsWith(extension)),
    );
}

/**
Parses the environment sources of the scope once in a run, for the two checks that read them.
*/
function listFileEnvironmentReads(
    session: Session,
    planned: PlannedCheck,
): Promise<Array<{ path: string; reads: EnvironmentRead[] }>> {
    return remember(session.cache, ENVIRONMENT_READS_KEY, planned.scope.path, async () => {
        const { environment_functions: environmentFunctions } = getTable(planned.scope.settings, 'secrets');
        const files: Array<{ path: string; reads: EnvironmentRead[] }> = [];
        for (const { path } of listEnvironmentSources(planned))
            files.push({ path, reads: await readEnvironmentReferences(session, path, environmentFunctions) });
        return files;
    });
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
Scans the staged change with Gitleaks. A full check, with no staged change, path, or pushed range to narrow it, scans
every file that Git does not ignore, so a secret that an earlier commit added still reports.
*/
async function checkGitleaksStaged(
    session: CheckSession,
    planned: PlannedCheck,
    options: Pick<CheckRunOptions, 'verbose' | 'command'>,
): Promise<CheckResult> {
    const { selection } = session;
    const isRepositoryWide =
        selection === undefined ||
        (selection.content === 'working-tree' && selection.paths === undefined && selection.reference === undefined);
    if (!isRepositoryWide || options.command !== undefined) return runCommandCheck(session, planned, options);
    assertCommandCheck(planned);
    const command = planned.check.command
        .filter((argument) => argument !== GITLEAKS_STAGED_FLAG)
        .map((argument) => {
            if (argument === GITLEAKS_GIT_MODE) return GITLEAKS_FILES_MODE;
            return argument === ROOT_PLACEHOLDER ? '.' : argument;
        });
    return keepListedFindings(session, await runCommandCheck(session, planned, { ...options, command }));
}

/**
Scans each pushed commit with Gitleaks, so a secret removed before the last commit still shows.
*/
async function checkGitleaksPushed(session: CheckSession, planned: PlannedCheck): Promise<CheckResult> {
    const commits = await readSelectedCommits(session.toolsRoot, session.selection?.commits, session.cancelSignal);
    if (commits.length === 0) return buildBaseResult(planned, session);
    const range = session.selection?.range ?? (await readPushedRange(session.toolsRoot, session.cancelSignal));
    assertCommandCheck(planned);
    return runCommandCheck(session, planned, {
        command: [...planned.check.command, GITLEAKS_LOG_FLAG, `${GITLEAKS_LOG_OPTIONS} ${range.join(' ')} --`],
    });
}

async function checkEnvironmentExamples(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const { environment_examples: names } = getTable(planned.scope.settings, 'secrets');
    const examples = planned.files.filter((file) => names.includes(posix.basename(file.path)));
    if (examples.length === 0)
        throw new CheckStop(
            'skipped',
            `No example environment file exists in ${planned.scope.path === '' ? ROOT_FOLDER_NAME : planned.scope.path}. List the example environment files in secrets.environment_examples.`,
        );
    const exampleKeys = new Set(
        examples.flatMap((file) => {
            const lines = readText(session.cache, file.path).split('\n');
            return lines.flatMap((line) => {
                const key = ENV_KEY_LINE.exec(line.trim())?.groups?.['key'];
                return key === undefined ? [] : [key];
            });
        }),
    );
    const files = await listFileEnvironmentReads(session, planned);
    return files.flatMap(({ path, reads }) => listMissingEnvironmentKeys(path, reads, exampleKeys));
}

async function checkEnvironmentDefaults(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = await listFileEnvironmentReads(session, planned);
    return files.flatMap(({ path, reads }) =>
        reads
            .filter(({ key = '', hasDefault }) => hasDefault === true && SECRET_KEY_NAME.test(key))
            .map(({ key, line, column }) => ({
                file: path,
                line,
                column,
                rule: ENVIRONMENT_DEFAULT_RULE,
                message: `${String(key)} has a literal fallback. A secret has no default: fail when it is missing.`,
            })),
    );
}

export const SECRETS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'secrets/environment-examples': { check: checkEnvironmentExamples },
    'secrets/environment-defaults': { check: checkEnvironmentDefaults },
    'secrets/gitleaks-staged': { run: checkGitleaksStaged },
    'secrets/gitleaks-pushed': { run: checkGitleaksPushed },
};
