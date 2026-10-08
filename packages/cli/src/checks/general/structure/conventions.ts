import { Query, type Node } from 'web-tree-sitter';
import { readSource } from '#cli/platform/root/public.ts';
import { parseSource } from '#cli/parsers/source/public.ts';
import { isToolProjectPath } from '#cli/repository/paths/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import type { CountedLanguage } from '#cli/types/parsers/statements.ts';
import { HOUSE_QUERIES } from '#cli/config/checks/general/structure.ts';
import type { HouseSource, HouseSourceInput } from '#cli/types/checks/general/structure.ts';

// Preserve native inventory selection, including extensionless shell sources.
function sourceLanguage(file: TrackedFile): CountedLanguage | undefined {
    if (file.path.endsWith('.py')) return 'python';
    if (file.path.endsWith('.swift')) return 'swift';
    return file.tags.includes('shell') ? 'bash' : undefined;
}

// Each grammar's one query supplies all four readers with the same native captures.
function captureSource(source: HouseSource): void {
    const query = new Query(source.tree.language, HOUSE_QUERIES[source.language]);
    try {
        for (const { name, node } of query.captures(source.tree.rootNode)) {
            const nodes = source.captures.get(name) ?? [];
            nodes.push(node);
            source.captures.set(name, nodes);
        }
    } finally {
        query.delete();
    }
}

/**
 * Read native convention captures for selected Bash, Python, and Swift sources.
 * @param input the scope-owned inventory and source reads
 * @returns observations whose native trees remain owned until their readers finish
 */
export async function readHouseSources(input: HouseSourceInput): Promise<HouseSource[]> {
    const sources: HouseSource[] = [];
    try {
        for (const file of input.files.filter((entry) => entry.kind === 'source' && !isToolProjectPath(entry.path))) {
            const language = sourceLanguage(file);
            if (language === undefined || !input.view.configurations.includes(language)) continue;
            const tree = await parseSource(
                language,
                readSource(input.root, file.path, input.reads).toString('utf8'),
                input,
            );
            const source = { path: file.path, language, tree, captures: new Map<string, Node[]>() };
            sources.push(source);
            captureSource(source);
        }
        return sources;
    } catch (error) {
        disposeHouseSources(sources);
        throw error;
    }
}

/**
 * Release native trees after all convention readers have finished.
 * @param sources the shared parsed observations
 */
export function disposeHouseSources(sources: HouseSource[]): void {
    for (const source of sources) source.tree.delete();
}
