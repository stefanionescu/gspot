import type { Node } from 'web-tree-sitter';
import type { Session } from '#cli/types/tools.ts';
import type { SourceTree } from '#cli/types/parsers.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { visitParsedSources } from '#cli/parsers/code/grammars.ts';
import type { CheckFinding } from '#cli/types/engine/tool-runs.ts';

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
} from '#cli/config/configurations/builds.ts';

function isPublicDeclaration(declaration: Node): boolean {
    const modifiers = declaration.namedChildren.find((child) => child.type === 'modifiers')?.namedChildren ?? [];
    return (
        modifiers.some(
            (modifier) => modifier.type === 'visibility_modifier' && PUBLIC_VISIBILITIES.has(modifier.text),
        ) && modifiers.every((modifier) => modifier.text !== OVERRIDE_MODIFIER)
    );
}

function getDocComment(declaration: Node): string {
    const lines: string[] = [];
    let row = declaration.startPosition.row;
    for (let comment = declaration.previousNamedSibling; comment !== null; comment = comment.previousNamedSibling) {
        if (
            !COMMENT_NODES.has(comment.type) ||
            comment.endPosition.row !== row - 1 ||
            !DOC_COMMENT_START.test(comment.text)
        )
            break;
        lines.unshift(comment.text);
        row = comment.startPosition.row;
    }
    return lines.join('\n');
}

function listMissingParameters(declaration: Node): string[] {
    const documented = new Set(
        getDocComment(declaration)
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

function listUndocumentedParameters(source: SourceTree): CheckFinding[] {
    const declarations = source.rootNode.descendantsOfType([...DOCUMENTED_DECLARATIONS]);
    const findings: CheckFinding[] = [];
    for (const declaration of declarations) {
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
    return findings;
}

/**
Reports each public or open function and initializer whose doc comment leaves a parameter out.

@param session the repository and its tools.
@param planned the scope Swift files.
*/
export async function checkSwiftDocComments(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const files = planned.files.map((file) => ({ path: file.path, grammar: 'swift' as const }));
    const findings: CheckFinding[] = [];
    await visitParsedSources({ cache: session.cache, resources: session.resources, files }, (source) => {
        findings.push(...listUndocumentedParameters(source));
    });
    return findings;
}
