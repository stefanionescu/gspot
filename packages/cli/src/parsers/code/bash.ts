import type { Node } from 'web-tree-sitter';
import { replaceRanges } from '#cli/system/text.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';

import {
    findSourceLine,
    parseTrapScripts,
    buildCommandCalls,
    listScriptCommands,
    listSwallowedLines,
} from '#cli/parsers/code/traps.ts';
import type {
    ParseCache,
    TrapScript,
    TrapCleanup,
    ScriptSyntax,
    TemporaryPath,
    ScriptTemporaryPaths,
} from '#cli/types/parsers/code.ts';
import {
    SHIFT_COMMAND,
    NOT_LINE_BREAK,
    END_OF_OPTIONS,
    REMOVE_COMMAND,
    GETOPTS_COMMAND,
    EXPANSION_NODES,
    BASH_BRANCH_NODES,
    FOR_HEADER_FIELDS,
    BASH_COMPOUND_NODES,
    POSITIONAL_PARAMETER,
    TEMPORARY_VALUE_NODES,
    TEMPORARY_FILE_COMMAND,
    LOCAL_DECLARATION_WORDS,
    ALL_POSITIONAL_PARAMETERS,
} from '#cli/config/parsers/code.ts';

function findHighestParameter(node: Node): number {
    const expansions = node.descendantsOfType([...EXPANSION_NODES]);
    const positions = expansions.flatMap((expansion) => {
        if (findFunctionNode(expansion)?.id !== node.id) return [];
        const parameter = expansion.namedChildren[0]?.text;
        if (parameter === undefined) return [];
        if (ALL_POSITIONAL_PARAMETERS.has(parameter)) return [Infinity];
        return POSITIONAL_PARAMETER.test(parameter) ? [Number(parameter)] : [];
    });
    if (
        node
            .descendantsOfType('command')
            .some(
                (command) =>
                    findFunctionNode(command)?.id === node.id &&
                    [SHIFT_COMMAND, GETOPTS_COMMAND].includes(command.childForFieldName('name')?.text ?? ''),
            )
    )
        return Infinity;
    return Math.max(0, ...positions);
}

function parseBashFunctions(syntaxRoot: Node): ScriptSyntax['functions'] {
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
                highestRead: findHighestParameter(node),
                branches: controls.filter((child) => BASH_BRANCH_NODES.includes(child.type)).length,
                nesting,
                assignments: node
                    .descendantsOfType('variable_assignment')
                    .filter(
                        (write) =>
                            findFunctionNode(write)?.id === node.id &&
                            ignored.every(
                                (range) => !(range.startIndex <= write.startIndex && range.endIndex >= write.endIndex),
                            ),
                    ).length,
            },
        ];
    });
}

function isTemporaryValue(assignment: Node): boolean {
    const value = assignment.childForFieldName('value');
    if (value === null || !TEMPORARY_VALUE_NODES.has(value.type) || value.namedChildCount !== 1) return false;
    const substitution = [value, ...value.namedChildren].find(
        (child) => child.type === 'command_substitution' && child.namedChildCount === 1,
    );
    return substitution?.namedChild(0)?.childForFieldName('name')?.text === TEMPORARY_FILE_COMMAND;
}

function listLocalNames(syntaxRoot: Node): Set<string> {
    const declarations = syntaxRoot
        .descendantsOfType('declaration_command')
        .filter(
            (declaration) =>
                LOCAL_DECLARATION_WORDS.has(declaration.child(0)?.text ?? '') &&
                declaration.namedChildren.every((child) => !(child.text.startsWith('-') && child.text.includes('g'))),
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

function buildScriptTemporaryPaths(syntaxRoot: Node): ScriptTemporaryPaths {
    const assignments = syntaxRoot.descendantsOfType('variable_assignment');
    const locals = listLocalNames(syntaxRoot);
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
        const isUnique = (locals.has(key) ? counts.get(key) : names.get(name)) === 1;
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
    const target = temporaryPaths.assigned.has(key) ? key : JSON.stringify([null, name]);
    return temporaryPaths.variables.get(target);
}

function addRemovals(removals: Node[], cleanup: TrapCleanup): void {
    const { sourceRows, owner, temporaryPaths, lines } = cleanup;
    for (const removal of removals) {
        const targets = listRemovedPaths(removal);
        const line = findSourceLine(removal, sourceRows);
        const paths = targets.map((argument) => findTemporaryPath(argument, owner, temporaryPaths));
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

function listTemporaryPaths(syntaxRoot: Node, commands: Node[], traps: TrapScript[]): TemporaryPath[] {
    const temporaryPaths = buildScriptTemporaryPaths(syntaxRoot);
    const lines = new Map<number, Array<TemporaryPath | undefined>>(
        commands
            .filter((command) => command.childForFieldName('name')?.text === REMOVE_COMMAND)
            .map((command) => [command.startPosition.row + 1, [undefined]]),
    );
    for (const { trap, sourceRows, syntaxRoot: script } of traps) {
        const assigned = new Set(
            script
                .descendantsOfType('variable_assignment')
                .map((assignment) => assignment.childForFieldName('name')?.text),
        );
        const removals = script
            .descendantsOfType('command')
            .filter((command) => command.childForFieldName('name')?.text === REMOVE_COMMAND);
        addRemovals(removals, {
            sourceRows,
            owner: findFunctionNode(trap)?.id,
            temporaryPaths: {
                ...temporaryPaths,
                variables: new Map([...temporaryPaths.variables].filter(([, path]) => !assigned.has(path.name))),
            },
            lines,
        });
    }
    const safe = [...lines].filter(([, paths]) => !paths.includes(undefined));
    for (const [line, paths] of safe) {
        const cleanedPaths = paths.filter((path): path is TemporaryPath => path !== undefined);
        for (const path of cleanedPaths) path.cleanupLines.push(line);
    }
    return temporaryPaths.paths;
}

/**
Parse a Bash script once: its code with comments blanked out, its functions, its calls, and its temporary files.

@param text the exact source.
@param cache the parser grammars of this run.
@returns the parsed facts, which stay valid after the tree goes away.
*/
export async function parseBashScript(text: string, cache?: ParseCache): Promise<ScriptSyntax> {
    using tree = await parseSource('bash', text, cache);
    const comments = tree.rootNode
        .descendantsOfType('comment')
        .map((comment) => ({ start: comment.startIndex, end: comment.endIndex }));
    const masked = text.replaceAll(NOT_LINE_BREAK, (character) => ' '.repeat(character.length));
    const codeText = replaceRanges(text, masked, comments);

    const commands = tree.rootNode
        .descendantsOfType(['command', 'declaration_command'])
        .filter((node) => node.type === 'command' || node.child(0)?.text === 'export');
    using resources = new DisposableStack();
    const traps = await parseTrapScripts(commands, cache, resources);
    const scripts = new Map(traps.map((script) => [script.trap.id, script]));
    const calls = commands.flatMap((node) => {
        const nodeCalls = buildCommandCalls([node]);
        const script = scripts.get(node.id);
        if (script !== undefined)
            nodeCalls.push(
                ...buildCommandCalls(
                    script.syntaxRoot
                        .descendantsOfType(['command', 'declaration_command'])
                        .filter((child) => child.type === 'command' || child.child(0)?.text === 'export'),
                    script.sourceRows,
                ),
            );
        return nodeCalls;
    });
    return {
        code: codeText.split('\n'),
        commands: listScriptCommands(commands, traps),
        swallowedLines: listSwallowedLines(tree.rootNode, traps),
        statements: tree.rootNode.namedChildren
            .filter((node) => node.type !== 'comment')
            .map((node) => ({ kind: node.type, text: node.text, line: node.startPosition.row + 1 })),
        functions: parseBashFunctions(tree.rootNode),
        calls,
        temporaryPaths: listTemporaryPaths(tree.rootNode, commands, traps),
    };
}

/**
Select non-blank code lines after the parser has masked comments.

@param lines the masked code, one entry per line.
@returns trimmed code and one-based positions.
*/
export function listCodeLines(lines: string[]): NumberedLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : { number: index + 1, text: code };
    });
}

/**
Find the function that contains a Bash syntax node.

@param node the syntax point to start from.
@returns undefined outside a function.
*/
export function findFunctionNode(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}
