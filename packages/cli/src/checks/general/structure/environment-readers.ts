import { buildFinding } from '#cli/runs/finding.ts';
import { parseCached } from '#cli/system/files/cache.ts';
import { readSwiftEnvironment } from '#cli/parsers/swift.ts';
import { readPythonEnvironment } from '#cli/parsers/python.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { ENV_NAME } from '#cli/config/checks/general/structure.ts';
import type { Finding, CheckInput } from '#cli/types/runs/check.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import { ENVIRONMENT_READERS_ROLE } from '#cli/config/settings/values.ts';
import { readBashEnvironment, findEnclosingFunction } from '#cli/parsers/bash.ts';
import { CONVENTION_SOURCES } from '#cli/checks/general/structure/convention-sources.ts';

/**
 * Reports environment reads outside the environment readers.
 * @param input the scope sources and roles.
 * @returns one finding per reading line.
 */
export async function checkEnvironmentReaders(input: CheckInput): Promise<Finding[]> {
    const readerPaths = input.selection.view.roles[ENVIRONMENT_READERS_ROLE];
    if (readerPaths.length === 0) return [];
    const isReader = buildPathMatcher(readerPaths);
    const readers = input.selection.view.configurations.includes('secrets')
        ? input.selection.view.options('secrets').environment_functions
        : [];
    const parsed = await parseCached(input, CONVENTION_SOURCES);
    const owned = new Set(
        parsed
            .filter((source) => source.language === 'bash' && isReader(source.path))
            .flatMap((source) =>
                (source.captures.get('assignment') ?? []).flatMap((node) => {
                    const name = node.childForFieldName('name')?.text;
                    return findEnclosingFunction(node) === undefined && name !== undefined && ENV_NAME.test(name)
                        ? [name]
                        : [];
                }),
            ),
    );
    return parsed.flatMap((source) => {
        if (isReader(source.path)) return [];
        let reads: EnvironmentRead[];
        if (source.language === 'python') reads = readPythonEnvironment(source.tree.rootNode, readers);
        else if (source.language === 'bash') reads = readBashEnvironment(source.tree.rootNode, owned);
        else reads = readSwiftEnvironment(source.tree.rootNode);
        const lines = new Map<number, EnvironmentRead>();
        for (const read of reads) if (!lines.has(read.line)) lines.set(read.line, read);
        return [...lines].map(([line, read]) => {
            const message = `${read.key ?? 'An environment variable'} is read here. Read environment variables only in the files that architecture.roles.environment_readers lists, and pass the value in.`;
            return buildFinding(input, { file: source.path, line }, 'read-outside-owner', message);
        });
    });
}
