import type { Node } from 'web-tree-sitter';
import type { NumberedLine } from '#cli/types/text.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import type { ParseCache } from '#cli/types/parsers/code/grammars.ts';
import type { TrapCleanup, ScriptSyntax, TemporaryPath, ScriptTemporaryPaths } from '#cli/types/parsers/code/bash.ts';

import {
    TRAP_COMMAND,
    SHIFT_COMMAND,
    NOT_LINE_BREAK,
    END_OF_OPTIONS,
    REMOVE_COMMAND,
    EXPANSION_NODES,
    BASH_BRANCH_NODES,
    FOR_HEADER_FIELDS,
    BASH_COMPOUND_NODES,
    FORWARDED_ARGUMENTS,
    POSITIONAL_PARAMETER,
    TEMPORARY_VALUE_NODES,
    TEMPORARY_FILE_COMMAND,
    LOCAL_DECLARATION_WORDS,
    ALL_POSITIONAL_PARAMETERS,
} from '#cli/config/parsers/code/bash.ts';

function findHighestParameter(node: Node): number {
    const expansions = node.descendantsOfType([...EXPANSION_NODES]);
    const positions = expansions.flatMap((expansion) => {
        if (findFunctionNode(expansion)?.id !== node.id) return [];
        const parameter = expansion.namedChildren[0]?.text;
        if (parameter === undefined) return [];
        if (ALL_POSITIONAL_PARAMETERS.has(parameter)) return [Number.POSITIVE_INFINITY];
        return POSITIONAL_PARAMETER.test(parameter) ? [Number(parameter)] : [];
    });
    if (
        node
            .descendantsOfType('command')
            .some(
                (command) =>
                    findFunctionNode(command)?.id === node.id &&
                    command.childForFieldName('name')?.text === SHIFT_COMMAND,
            )
    )
        return Number.POSITIVE_INFINITY;
    return Math.max(0, ...positions);
}

function parseBashFunctions(syntaxRoot: Node, codeText: string): ScriptSyntax['functions'] {
    return syntaxRoot.descendantsOfType('function_definition').flatMap((node) => {
        const name = node.childForFieldName('name')?.text;
        const body = node.childForFieldName('body');
        if (name === undefined || body === null) return [];
        const controls = node
            .descendantsOfType([...BASH_BRANCH_NODES, ...BASH_COMPOUND_NODES])
            .filter((child) => findFunctionNode(child)?.id === node.id);
        const compoundNodes = controls.filter((child) => BASH_COMPOUND_NODES.includes(child.type));

        const nesting = Math.max(
            0,
            ...compoundNodes.map((child) => {
                let depth = 1;
                for (let parent = child.parent; parent !== null && parent.id !== node.id; parent = parent.parent) {
                    const parentId = parent.id;
                    if (compoundNodes.some((compound) => compound.id === parentId)) depth += 1;
                }
                return depth;
            }),
        );
        const ignored = [
            ...node.descendantsOfType('declaration_command'),
            ...compoundNodes
                .filter((control) => control.type === 'c_style_for_statement')
                .flatMap((loop) => FOR_HEADER_FIELDS.flatMap((field) => loop.childrenForFieldName(field))),
        ];
        return [
            {
                name,
                start: node.startPosition.row + 1,
                end: node.endPosition.row + 1,
                body: codeText.slice(body.startIndex + 1, body.endIndex - 1).split('\n'),
                highestRead: findHighestParameter(node),
                branches: controls.filter((child) => BASH_BRANCH_NODES.includes(child.type)).length,
                nesting,
                assignments: node
                    .descendantsOfType('variable_assignment')
                    .filter(
                        (write) =>
                            findFunctionNode(write)?.id === node.id &&
                            !ignored.some(
                                (range) => range.startIndex <= write.startIndex && range.endIndex >= write.endIndex,
                            ),
                    ).length,
            },
        ];
    });
}

function stripComments(text: string, comments: Node[]): string {
    const pieces: string[] = [];
    let offset = 0;
    for (const comment of comments) {
        pieces.push(
            text.slice(offset, comment.startIndex),
            text
                .slice(comment.startIndex, comment.endIndex)
                .replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length)),
        );
        offset = comment.endIndex;
    }
    pieces.push(text.slice(offset));
    return pieces.join('');
}

function isTemporaryValue(assignment: Node): boolean {
    const value = assignment.childForFieldName('value');
    if (value === null) return false;
    if (!TEMPORARY_VALUE_NODES.has(value.type)) return false;
    if (value.namedChildCount !== 1) return false;
    const substitution = [value, ...value.namedChildren].find(
        (child) => child.type === 'command_substitution' && child.namedChildCount === 1,
    );
    return substitution?.namedChild(0)?.childForFieldName('name')?.text === TEMPORARY_FILE_COMMAND;
}

function listLocalNames(root: Node): Set<string> {
    const declarations = root
        .descendantsOfType('declaration_command')
        .filter(
            (declaration) =>
                LOCAL_DECLARATION_WORDS.has(declaration.child(0)?.text ?? '') &&
                !declaration.namedChildren.some((child) => child.text.startsWith('-') && child.text.includes('g')),
        );
    return new Set(
        declarations.flatMap((declaration) => {
            const owner = findFunctionNode(declaration)?.id;
            if (owner === undefined) return [];
            return declaration.namedChildren.flatMap((child) => {
                let name: string | undefined;
                if (child.type === 'variable_assignment') name = child.childForFieldName('name')?.text;
                else if (child.type === 'variable_name') name = child.text;
                return name === undefined ? [] : [JSON.stringify([owner, name])];
            });
        }),
    );
}

function buildScriptTemporaryPaths(root: Node): ScriptTemporaryPaths {
    const assignments = root.descendantsOfType('variable_assignment');
    const locals = listLocalNames(root);
    const counts = new Map<string, number>();
    const names = new Map<string, number>();
    for (const assignment of assignments) {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined) continue;
        const key = JSON.stringify([findFunctionNode(assignment)?.id, name]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        names.set(name, (names.get(name) ?? 0) + 1);
    }
    const targets = new Map<string, TemporaryPath>();
    const paths = assignments.flatMap((assignment) => {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined || !isTemporaryValue(assignment)) return [];
        const key = JSON.stringify([findFunctionNode(assignment)?.id, name]);
        const path: TemporaryPath = { name, line: assignment.startPosition.row + 1, cleanupLines: [] };
        const isUnique = locals.has(key) ? counts.get(key) === 1 : names.get(name) === 1;
        if (isUnique) targets.set(key, path);
        return [path];
    });
    return { paths, variables: targets, assigned: new Set([...counts.keys(), ...locals]) };
}

function findTemporaryPath(
    argument: Node,
    owner: number | undefined,
    temporaryPaths: ScriptTemporaryPaths,
): TemporaryPath | undefined {
    const references = argument.type === 'string' ? argument.namedChildren : [argument];
    if (references.length !== 1) return undefined;
    const reference = references.find((node) => EXPANSION_NODES.includes(node.type));
    if (reference === undefined) return undefined;
    const name = reference.namedChildren[0]?.text;
    if (name === undefined) return undefined;
    if (![`$${name}`, `\${${name}}`].includes(reference.text)) return undefined;
    const key = JSON.stringify([owner, name]);
    const target = temporaryPaths.assigned.has(key) ? key : JSON.stringify([undefined, name]);
    return temporaryPaths.variables.get(target);
}

function addRemovals(removals: Node[], cleanup: TrapCleanup): void {
    const { lineOffset, owner, registry, lines } = cleanup;
    for (const removal of removals) {
        const targets = listRemovedPaths(removal);
        const line = lineOffset + removal.startPosition.row;
        const paths = targets.map((argument) => findTemporaryPath(argument, owner, registry));
        lines.set(line, [...(lines.get(line) ?? []), ...(paths.length === 0 ? [undefined] : paths)]);
    }
}

function listRemovedPaths(command: Node): Node[] {
    const targets: Node[] = [];
    let isOptions = true;
    for (const argument of command.childrenForFieldName('argument')) {
        if (isOptions && argument.text === END_OF_OPTIONS) {
            isOptions = false;
            continue;
        }
        if (isOptions && argument.text.startsWith('-')) continue;
        targets.push(argument);
    }
    return targets;
}

async function listTemporaryPaths(root: Node, commands: Node[], cache?: ParseCache): Promise<TemporaryPath[]> {
    const registry = buildScriptTemporaryPaths(root);
    const lines = new Map<number, Array<TemporaryPath | undefined>>(
        commands
            .filter((command) => command.childForFieldName('name')?.text === REMOVE_COMMAND)
            .map((command) => [command.startPosition.row + 1, [undefined]]),
    );
    const traps = commands.filter((command) => command.childForFieldName('name')?.text === TRAP_COMMAND);
    for (const trap of traps) {
        const [body, ...signals] = trap
            .childrenForFieldName('argument')
            .filter((argument) => argument.text !== END_OF_OPTIONS);
        if (body?.type !== 'raw_string' || signals.length === 0) continue;
        const tree = await parseSource('bash', body.text.slice(1, -1), cache);
        try {
            const assigned = new Set(
                tree.rootNode
                    .descendantsOfType('variable_assignment')
                    .map((assignment) => assignment.childForFieldName('name')?.text),
            );
            const removals = tree.rootNode
                .descendantsOfType('command')
                .filter((command) => command.childForFieldName('name')?.text === REMOVE_COMMAND);
            addRemovals(removals, {
                lineOffset: body.startPosition.row + 1,
                owner: findFunctionNode(trap)?.id,
                registry: {
                    ...registry,
                    variables: new Map([...registry.variables].filter(([, path]) => !assigned.has(path.name))),
                },
                lines,
            });
        } finally {
            tree.delete();
        }
    }
    const safe = [...lines].filter(([, paths]) => !paths.includes(undefined));
    for (const [line, paths] of safe) {
        const temporaryPaths = paths.filter((path): path is TemporaryPath => path !== undefined);
        for (const path of temporaryPaths) path.cleanupLines.push(line);
    }
    return registry.paths;
}

/**
 * Parse a Bash script once: its code with comments blanked out, its functions, its calls, and its temporary files.
 *
 * @param text the exact source.
 * @param cache the parser grammars of this run.
 * @returns the parsed facts, which stay valid after the tree goes away.
 */
export async function parseBashScript(text: string, cache?: ParseCache): Promise<ScriptSyntax> {
    const tree = await parseSource('bash', text, cache);
    try {
        const codeText = stripComments(text, tree.rootNode.descendantsOfType('comment'));

        const commands = tree.rootNode.descendantsOfType('command');

        const functions = parseBashFunctions(tree.rootNode, codeText);
        const calls = commands.flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            if (name === undefined) return [];
            const commandArguments = node.childrenForFieldName('argument');
            const trapFunction = name === TRAP_COMMAND ? commandArguments[0] : undefined;
            return [
                {
                    name,
                    count: commandArguments.length,
                    line: node.startPosition.row + 1,
                    forwards: commandArguments.some((argument) => FORWARDED_ARGUMENTS.has(argument.text)),
                },
                ...(trapFunction?.type === 'word'
                    ? [{ name: trapFunction.text, count: 0, line: trapFunction.startPosition.row + 1, forwards: false }]
                    : []),
            ];
        });
        return {
            code: codeText.split('\n'),
            functions,
            calls,
            temporaryPaths: await listTemporaryPaths(tree.rootNode, commands, cache),
        };
    } finally {
        tree.delete();
    }
}

/**
 * Select non-blank code lines after the parser has masked comments.
 *
 * @param lines the masked code, one entry per line.
 * @returns trimmed code and one-based positions.
 */
export function listCodeLines(lines: string[]): NumberedLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : [{ number: index + 1, text: code }];
    });
}

/**
 * Find the function that contains a Bash syntax node.
 *
 * @param node the syntax point to start from.
 * @returns the containing function, or undefined outside a function.
 */
export function findFunctionNode(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}
