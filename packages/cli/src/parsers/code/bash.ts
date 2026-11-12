import type { Node } from 'web-tree-sitter';

import {
    ALL_POSITIONAL_PARAMETERS,
    BASH_BRANCH_NODES,
    BASH_COMPOUND_NODES,
    END_OF_OPTIONS,
    EXPANSION_NODES,
    FOR_HEADER_FIELDS,
    GETOPTS_COMMAND,
    GLOBAL_DECLARATION_FLAG,
    LOCAL_DECLARATION_WORDS,
    POSITIONAL_PARAMETER,
    REMOVE_COMMAND,
    SHIFT_COMMAND,
    TEMPORARY_FILE_COMMAND,
    TEMPORARY_VALUE_NODES,
} from '#cli/config/parsers/code.ts';
import { blankText } from '#cli/parsers/code/comments.ts';
import { parseSource } from '#cli/parsers/code/grammars.ts';
import {
    buildCommandCalls,
    findSourceLine,
    listScriptCommands,
    listScriptForms,
    listSwallowedLines,
    parseTrapScripts,
} from '#cli/parsers/code/traps.ts';
import { replaceRanges } from '#cli/system/text.ts';
import type {
    NumberedLine,
    ParseCache,
    Removal,
    ScriptSyntax,
    ScriptTemporaryPaths,
    TemporaryPath,
    TrapCleanup,
    TrapScript,
} from '#cli/types/parsers.ts';

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

function buildVariableKey(functionId: number | undefined, name: string): string {
    return `${String(functionId ?? 'top')}:${name}`;
}

function findVariableName(child: Node): string | undefined {
    if (child.type === 'variable_assignment') return child.childForFieldName('name')?.text;
    return child.type === 'variable_name' ? child.text : undefined;
}

function listLocalNames(syntaxRoot: Node): Set<string> {
    const declarations = syntaxRoot.descendantsOfType('declaration_command').filter((declaration) => {
        const isGlobalDeclaration = declaration.namedChildren.some((child) => GLOBAL_DECLARATION_FLAG.test(child.text));
        return LOCAL_DECLARATION_WORDS.has(declaration.child(0)?.text ?? '') && !isGlobalDeclaration;
    });
    return new Set(
        declarations.flatMap((declaration) => {
            const owner = findFunctionNode(declaration)?.id;
            if (owner === undefined) return [];
            return declaration.namedChildren.flatMap((child) => {
                const name = findVariableName(child);
                return name === undefined ? [] : [buildVariableKey(owner, name)];
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
        const key = buildVariableKey(findFunctionNode(assignment)?.id, name);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        names.set(name, (names.get(name) ?? 0) + 1);
    }
    const targets = new Map<string, TemporaryPath>();
    const paths = assignments.flatMap((assignment) => {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined || !isTemporaryValue(assignment)) return [];
        const key = buildVariableKey(findFunctionNode(assignment)?.id, name);
        const path: TemporaryPath = {
            name,
            line: assignment.startPosition.row + 1,
            cleanupLines: [],
            removalLines: [],
        };
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
    if (name === undefined || ![`$${name}`, `\${${name}}`].includes(reference.text)) return undefined;
    const key = buildVariableKey(owner, name);
    const target = temporaryPaths.assigned.has(key) ? key : buildVariableKey(undefined, name);
    return temporaryPaths.variables.get(target);
}

function addRemovals(removals: Node[], cleanup: TrapCleanup): void {
    const { sourceRows, owner, temporaryPaths } = cleanup;
    for (const removal of removals) {
        const paths = listRemovedPaths(removal).map((argument) => findTemporaryPath(argument, owner, temporaryPaths));
        cleanup.removals.push({
            line: findSourceLine(removal, sourceRows),
            paths: paths.every((path) => path !== undefined) ? paths : [],
        });
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

function addDirectRemovals(commands: Node[], temporaryPaths: ScriptTemporaryPaths): void {
    for (const command of commands) {
        const owner = findFunctionNode(command)?.id;
        const paths = listRemovedPaths(command).map((argument) => findTemporaryPath(argument, owner, temporaryPaths));
        if (paths.length > 0 && paths.every((path) => path !== undefined))
            for (const path of paths) path.removalLines.push(command.startPosition.row + 1);
    }
}

function listTemporaryPaths(syntaxRoot: Node, commands: Node[], traps: TrapScript[]): TemporaryPath[] {
    const temporaryPaths = buildScriptTemporaryPaths(syntaxRoot);
    const removers = commands.filter((command) => command.childForFieldName('name')?.text === REMOVE_COMMAND);
    const removedPaths: Removal[] = removers.map(({ startPosition }) => ({ line: startPosition.row + 1, paths: [] }));
    addDirectRemovals(removers, temporaryPaths);
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
            removals: removedPaths,
        });
    }
    const unsafeLines = new Set(removedPaths.filter(({ paths }) => paths.length === 0).map(({ line }) => line));
    for (const { line, paths } of removedPaths)
        if (!unsafeLines.has(line)) for (const path of paths) path.cleanupLines.push(line);
    return temporaryPaths.paths;
}

function listCommandNodes(root: Node): Node[] {
    return root
        .descendantsOfType(['command', 'declaration_command'])
        .filter((node) => node.type === 'command' || node.child(0)?.text === 'export');
}

export async function parseBashScript(text: string, cache?: ParseCache): Promise<ScriptSyntax> {
    using tree = await parseSource('bash', text, cache);
    const comments = tree.rootNode
        .descendantsOfType('comment')
        .map((comment) => ({ start: comment.startIndex, end: comment.endIndex }));
    const codeText = replaceRanges(text, blankText(text), comments);
    const commands = listCommandNodes(tree.rootNode);
    const trapTrees: Disposable[] = [];
    try {
        const traps = await parseTrapScripts(commands, cache, trapTrees);
        const scripts = new Map(traps.map((script) => [script.trap.id, script]));
        const calls = commands.flatMap((node) => {
            const nodeCalls = buildCommandCalls([node]);
            const script = scripts.get(node.id);
            if (script !== undefined)
                nodeCalls.push(...buildCommandCalls(listCommandNodes(script.syntaxRoot), script.sourceRows));
            return nodeCalls;
        });
        return {
            code: codeText.split('\n'),
            commands: listScriptCommands(commands, traps),
            forms: listScriptForms(tree.rootNode),
            swallowedLines: listSwallowedLines(tree.rootNode, traps),
            statements: tree.rootNode.namedChildren
                .filter((node) => node.type !== 'comment')
                .map((node) => ({ kind: node.type, text: node.text, line: node.startPosition.row + 1 })),
            functions: parseBashFunctions(tree.rootNode),
            calls,
            temporaryPaths: listTemporaryPaths(tree.rootNode, commands, traps),
        };
    } finally {
        for (const trapTree of trapTrees) trapTree[Symbol.dispose]();
    }
}

export function listCodeLines(lines: string[]): NumberedLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : { number: index + 1, text: code };
    });
}

export function findFunctionNode(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}
