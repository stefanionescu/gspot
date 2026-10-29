import { getTable } from '#cli/settings/scopes.ts';
import type { Session } from '#cli/types/session.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { findFunctionNode } from '#cli/parsers/code/bash.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { VARIABLE_NAME } from '#cli/config/parsers/code/environment.ts';
import type { EnvironmentRead } from '#cli/types/parsers/code/environment.ts';
import { PARSED_SOURCES } from '#cli/checks/general/structure/parsed-sources.ts';

import {
    UNNAMED_VARIABLE_LABEL,
    READ_OUTSIDE_READER_RULE,
} from '#cli/config/checks/general/structure/environment-readers.ts';
import {
    listBashEnvironmentReads,
    listSwiftEnvironmentReads,
    listPythonEnvironmentReads,
} from '#cli/parsers/code/environment.ts';

/**
Reports each line that reads an environment variable outside the files that structure.environment_readers lists.

@param session the repository and its tools.
@param planned the scope sources and roles.
*/
export async function checkStructureEnvironmentReaders(
    session: Session,
    planned: PlannedCheck,
): Promise<CheckFinding[]> {
    const readerPaths = getTable(planned.scope.settings, 'structure').environment_readers;
    const isReader = buildPathMatcher(readerPaths);
    const environmentFunctions = planned.scope.settings.configurations.includes('secrets')
        ? getTable(planned.scope.settings, 'secrets').environment_functions
        : [];
    const parsed = await parseCached({ ...session, files: planned.files, scope: planned.scope }, PARSED_SOURCES);
    const readerVariables = new Set(
        parsed
            .filter((source) => source.language === 'bash' && isReader(source.path))
            .flatMap((source) =>
                (source.captures.get('assignment') ?? []).flatMap((node) => {
                    const name = node.childForFieldName('name')?.text;
                    return name !== undefined && findFunctionNode(node) === undefined && VARIABLE_NAME.test(name)
                        ? [name]
                        : [];
                }),
            ),
    );
    return parsed.flatMap((source) => {
        if (isReader(source.path)) return [];
        let reads: EnvironmentRead[];
        if (source.language === 'python')
            reads = listPythonEnvironmentReads(source.tree.rootNode, environmentFunctions);
        else if (source.language === 'bash') reads = listBashEnvironmentReads(source.tree.rootNode, readerVariables);
        else reads = listSwiftEnvironmentReads(source.tree.rootNode);
        const lines = new Map<number, EnvironmentRead>();
        for (const read of reads) if (!lines.has(read.line)) lines.set(read.line, read);
        return [...lines].map(([line, read]) => {
            const message = `${read.key ?? UNNAMED_VARIABLE_LABEL} is read here. Read environment variables only in the files that structure.environment_readers lists, and pass the value in.`;
            return {
                file: source.path,
                line,
                rule: READ_OUTSIDE_READER_RULE,
                message: message,
            };
        });
    });
}
