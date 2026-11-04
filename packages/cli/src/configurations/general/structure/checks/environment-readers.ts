import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/tools.ts';
import { VARIABLE_NAME } from '#cli/config/parsers.ts';
import type { CheckCode } from '#cli/types/engine/run.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import { findFunctionNode } from '#cli/parsers/code/bash.ts';
import type { EnvironmentRead } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';
import type { ParsedSource } from '#cli/types/configurations/general.ts';
import { visitQueriedSources } from '#cli/configurations/general/structure/checks/parsed-sources.ts';
import { UNNAMED_VARIABLE_LABEL, READ_OUTSIDE_READER_RULE } from '#cli/config/configurations/structure.ts';

import {
    listBashEnvironmentReads,
    listSwiftEnvironmentReads,
    listPythonEnvironmentReads,
} from '#cli/parsers/code/environment.ts';

function listEnvironmentReads(
    source: ParsedSource,
    environmentFunctions: string[],
    readerVariables: Set<string>,
): EnvironmentRead[] {
    const { language, rootNode } = source;
    switch (language) {
        case 'python': {
            return listPythonEnvironmentReads(rootNode, environmentFunctions);
        }
        case 'bash': {
            return listBashEnvironmentReads(rootNode, readerVariables);
        }
        case 'swift': {
            return listSwiftEnvironmentReads(rootNode);
        }
        default: {
            const unknown: never = language;
            throw new Error(`No environment reader for ${String(unknown)}.`);
        }
    }
}

async function listReaderVariables(
    session: Session,
    planned: Pick<PlannedCheck, 'files' | 'scope'>,
): Promise<Set<string>> {
    const variables = new Set<string>();
    await visitQueriedSources(session, planned, (source) => {
        if (source.language !== 'bash') return;
        const names = (source.captures.get('assignment') ?? [])
            .filter((node) => findFunctionNode(node) === undefined)
            .map((node) => node.childForFieldName('name')?.text)
            .filter((name): name is string => name !== undefined && VARIABLE_NAME.test(name));
        for (const name of names) variables.add(name);
    });
    return variables;
}

/**
Reports each line that reads an environment variable outside the files that structure.environment_readers lists.

@param session the repository and its tools.
@param planned the scope sources and roles.
*/
async function checkEnvironmentReaders(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const readerPaths = getTable(planned.scope.settings, 'structure').environment_readers;
    const isReader = buildPathMatcher(readerPaths);
    const environmentFunctions = planned.scope.settings.configurations.includes('secrets')
        ? getTable(planned.scope.settings, 'secrets').environment_functions
        : [];
    const readers = planned.files.filter((file) => isReader(file.path));
    const readerVariables = await listReaderVariables(session, { ...planned, files: readers });
    const findings: CheckFinding[] = [];
    const others = planned.files.filter((file) => !isReader(file.path));
    await visitQueriedSources(session, { ...planned, files: others }, (source) => {
        const reads = listEnvironmentReads(source, environmentFunctions, readerVariables);
        const lines = new Map<number, EnvironmentRead>();
        for (const read of reads) if (!lines.has(read.line)) lines.set(read.line, read);
        for (const [line, read] of lines)
            findings.push({
                file: source.path,
                line,
                rule: READ_OUTSIDE_READER_RULE,
                message: `${read.key ?? UNNAMED_VARIABLE_LABEL} is read here. Read environment variables only in the files that structure.environment_readers lists, and pass the value in.`,
            });
    });
    return findings;
}

export const ENVIRONMENT_READERS_CHECKS: Readonly<Record<string, CheckCode>> = {
    'structure/environment-readers': { check: checkEnvironmentReaders },
};
