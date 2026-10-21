import { buildFinding } from '#cli/runs/finding.ts';
import { getTable } from '#cli/settings/scope-view.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { readSwiftEnvironment } from '#cli/parsers/swift.ts';
import { ENV_NAME } from '#cli/config/parsers/environment.ts';
import { readPythonEnvironment } from '#cli/parsers/python.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import type { Session, PlannedCheck } from '#cli/types/planning.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import { findFunctionNode, readBashEnvironment } from '#cli/parsers/bash.ts';
import { CONVENTION_SOURCES } from '#cli/checks/structure/convention-sources.ts';

/**
 * Reports environment reads outside the environment readers.
 *
 * @param session the repository and its tools.
 * @param planned the scope sources and roles.
 * @returns one finding per reading line.
 */
export async function checkEnvironmentReaders(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const readerPaths = planned.selection.view.values.structure?.environment_readers ?? [];
    if (readerPaths.length === 0) return [];
    const isReader = buildPathMatcher(readerPaths);
    const readers = planned.selection.view.configurations.includes('secrets')
        ? getTable(planned.selection.view, 'secrets').environment_functions
        : [];
    const parsed = await parseCached(
        { ...session, files: planned.files, selection: planned.selection },
        CONVENTION_SOURCES,
    );
    const readerVariables = new Set(
        parsed
            .filter((source) => source.language === 'bash' && isReader(source.path))
            .flatMap((source) =>
                (source.captures.get('assignment') ?? []).flatMap((node) => {
                    const name = node.childForFieldName('name')?.text;
                    return findFunctionNode(node) === undefined && name !== undefined && ENV_NAME.test(name)
                        ? [name]
                        : [];
                }),
            ),
    );
    return parsed.flatMap((source) => {
        if (isReader(source.path)) return [];
        let reads: EnvironmentRead[];
        if (source.language === 'python') reads = readPythonEnvironment(source.tree.rootNode, readers);
        else if (source.language === 'bash') reads = readBashEnvironment(source.tree.rootNode, readerVariables);
        else reads = readSwiftEnvironment(source.tree.rootNode);
        const lines = new Map<number, EnvironmentRead>();
        for (const read of reads) if (!lines.has(read.line)) lines.set(read.line, read);
        return [...lines].map(([line, read]) => {
            const message = `${read.key ?? 'An environment variable'} is read here. Read environment variables only in the files that structure.environment_readers lists, and pass the value in.`;
            return buildFinding(planned, { file: source.path, line }, 'read-outside-reader', message);
        });
    });
}
