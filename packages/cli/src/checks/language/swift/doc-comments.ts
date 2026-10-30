import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/session.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';

import {
    COMMENT_NODES,
    INITIALIZER_NAME,
    OVERRIDE_MODIFIER,
    DOC_COMMENT_START,
    UNNAMED_PARAMETER,
    PUBLIC_VISIBILITIES,
    DOCUMENTED_PARAMETER,
    MISSING_PARAMETER_RULE,
    DOCUMENTED_DECLARATIONS,
} from '#cli/config/checks/language/swift/doc-comments.ts';

function isPublicDeclaration(declaration: Node): boolean {
    const modifiers = declaration.namedChildren.find((child) => child.type === 'modifiers')?.namedChildren ?? [];
    return (
        modifiers.some(
            (modifier) => modifier.type === 'visibility_modifier' && PUBLIC_VISIBILITIES.has(modifier.text),
        ) && modifiers.every((modifier) => modifier.text !== OVERRIDE_MODIFIER)
    );
}

function readDocComment(declaration: Node): string {
    const lines: string[] = [];
    let row = declaration.startPosition.row;
    for (let comment = declaration.previousNamedSibling; comment !== null; comment = comment.previousNamedSibling) {
        if (!COMMENT_NODES.has(comment.type) || comment.endPosition.row !== row - 1) break;
        if (!DOC_COMMENT_START.test(comment.text)) break;
        lines.unshift(comment.text);
        row = comment.startPosition.row;
    }
    return lines.join('\n');
}

function listMissingParameters(declaration: Node): string[] {
    const documented = new Set(
        readDocComment(declaration)
            .matchAll(DOCUMENTED_PARAMETER)
            .map((match) => match.groups?.['name']),
    );
    return declaration.namedChildren
        .filter((child) => child.type === 'parameter')
        .flatMap((parameter) => {
            const name = parameter.childForFieldName('name')?.text ?? UNNAMED_PARAMETER;
            const label = parameter.childForFieldName('external_name')?.text;
            return name === UNNAMED_PARAMETER || documented.has(name) || (label !== undefined && documented.has(label))
                ? []
                : [name];
        });
}

/**
Reports each public or open function and initializer whose doc comment leaves a parameter out.

@param session the repository and its tools.
@param planned the scope Swift files.
*/
export async function checkSwiftDocComments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ reads: session.reads, resources: session.resources, files }, (source) => {
        for (const declaration of source.rootNode.descendantsOfType([...DOCUMENTED_DECLARATIONS])) {
            if (!isPublicDeclaration(declaration)) continue;
            const missing = listMissingParameters(declaration);
            if (missing.length === 0) continue;
            const name = declaration.childForFieldName('name')?.text ?? INITIALIZER_NAME;
            const parameters = missing.map((parameter) => `\`${parameter}\``).join(', ');
            findings.push({
                file: source.path,
                line: declaration.startPosition.row + 1,
                column: declaration.startPosition.column + 1,
                rule: MISSING_PARAMETER_RULE,
                message: `The doc comment of ${name} does not document ${parameters}. Add a \`- Parameter <name>:\` line for each one, or a \`- Parameters:\` list.`,
            });
        }
    });
    return findings;
}
