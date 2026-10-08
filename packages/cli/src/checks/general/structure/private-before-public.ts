import type { Node } from 'web-tree-sitter';
import { findingAt } from '#cli/checks/finding.ts';
import { visitParsed } from '#cli/parsers/tree-sitter.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { FILE_LOCAL } from '#cli/config/checks/language/swift.ts';
import type { HouseSource, HouseDeclaration } from '#cli/types/checks/general/structure.ts';
import { readHouseSources, disposeHouseSources } from '#cli/checks/general/structure/conventions.ts';

// Setter visibility does not make the declaration's getter file-local.
function visibilityOf(node: Node): string {
    return (
        node.namedChildren
            .filter((child) => child.type === 'modifiers')
            .flatMap((child) => child.namedChildren)
            .find((modifier) => modifier.type === 'visibility_modifier' && !modifier.text.endsWith('(set)'))?.text ??
        'internal'
    ).trim();
}

// Capture identity and visibility once before the common ordering calculation.
function sourceDeclarations(source: HouseSource): HouseDeclaration[] {
    const kind = source.language === 'swift' ? 'declaration' : 'function';
    return (source.captures.get(kind) ?? [])
        .filter(
            (node) =>
                source.language === 'bash' ||
                node.parent?.type === 'module' ||
                node.parent?.type === 'source_file' ||
                node.parent?.parent?.type === 'module',
        )
        .map((node) => {
            const name = node.childForFieldName('name')?.text ?? 'This declaration';
            let visibility = name.startsWith('_') ? 'private' : 'public';
            if (source.language === 'swift') visibility = visibilityOf(node);
            return { node, name, visibility, isDunder: source.language === 'python' && name.startsWith('__') };
        });
}

// Language syntax determines the message, while the ordering rule is shared.
function orderMessage(source: HouseSource, entry: HouseDeclaration): string {
    const { node, name, visibility } = entry;
    if (source.language === 'swift') {
        const title =
            node.childForFieldName('declaration_kind')?.text === 'extension' ? `The extension of ${name}` : name;
        return `${title} is ${visibility} and sits below a declaration other files see. File-local declarations come first.`;
    }
    return `${name} is private and sits below a public function.${source.language === 'python' ? ' Private functions come first.' : ''}`;
}

/**
 * Report private declarations below public declarations, retaining shell entrypoint order.
 * @param input the selected source files and effective policy
 * @returns findings at the original declaration lines
 */
export async function privateBeforePublic(input: CheckInput): Promise<Finding[]> {
    using parsed = await visitParsed(input, readHouseSources, disposeHouseSources);
    return parsed.value.flatMap((source) => {
        const declarations = sourceDeclarations(source);
        const firstPublic = declarations.findIndex((entry) => !FILE_LOCAL.has(entry.visibility));
        if (firstPublic === -1) return [];
        const findings = declarations
            .slice(firstPublic + 1)
            .filter((entry) => FILE_LOCAL.has(entry.visibility) && !entry.isDunder)
            .map((entry) =>
                findingAt(
                    input,
                    { file: source.path, line: entry.node.startPosition.row + 1 },
                    'private-before-public',
                    orderMessage(source, entry),
                ),
            );
        const [main] = source.captures.get('entrypoint') ?? [];
        if (main !== undefined && declarations.at(-1)?.node.id !== main.id)
            findings.push(
                findingAt(
                    input,
                    { file: source.path, line: main.startPosition.row + 1 },
                    'main-not-last',
                    'main is not the last function.',
                ),
            );
        return findings;
    });
}
