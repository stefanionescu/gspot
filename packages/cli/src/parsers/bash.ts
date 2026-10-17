// Parses Bash scripts and counts their functions and control flow.
import type { Node } from 'web-tree-sitter';
import { convertToSpaces } from '#cli/system/text.ts';
import type { NumberedLine } from '#cli/types/text.ts';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import type { ParseCache } from '#cli/types/parsers/tree-sitter.ts';
import type { EnvironmentRead } from '#cli/types/parsers/environment.ts';
import type { ScriptSyntax, TemporaryPath, CleanupContext, TemporaryTargets } from '#cli/types/parsers/bash.ts';

import {
    TRAP_COMMAND,
    SHIFT_COMMAND,
    END_OF_OPTIONS,
    REMOVE_COMMAND,
    EXPANSION_NODES,
    BASH_BRANCH_NODES,
    FOR_HEADER_FIELDS,
    BASH_COMPOUND_NODES,
    POSITIONAL_PARAMETER,
    TEMPORARY_VALUE_NODES,
    TEMPORARY_FILE_COMMAND,
    LOCAL_DECLARATION_WORDS,
    ALL_POSITIONAL_PARAMETERS,
} from '#cli/config/parsers/bash.ts';

function findHighestParameter(node: Node): number {
    const expansions = node.descendantsOfType([...EXPANSION_NODES]);
    const positions = expansions.flatMap((expansion) => {
        if (findEnclosingFunction(expansion)?.id !== node.id) return [];
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
                    findEnclosingFunction(command)?.id === node.id &&
                    command.childForFieldName('name')?.text === SHIFT_COMMAND,
            )
    )
        return Number.POSITIVE_INFINITY;
    return Math.max(0, ...positions);
}

/**
 * Find the function that contains a Bash syntax node.
 * @param node the syntax point to start from.
 * @returns the containing function, or undefined outside a function.
 */
function findEnclosingFunction(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}

/**
 * Read the syntax of each function, without nested function bodies.
 * @param syntaxRoot the parsed Bash root.
 * @param codeText source with comments masked at their original positions.
 * @returns function metrics and source spans.
 */
function parseBashFunctions(syntaxRoot: Node, codeText: string): ScriptSyntax['functions'] {
    return syntaxRoot.descendantsOfType('function_definition').flatMap((node) => {
        const name = node.childForFieldName('name')?.text;
        const body = node.childForFieldName('body');
        if (name === undefined || body === null) return [];
        const controls = node
            .descendantsOfType([...BASH_BRANCH_NODES, ...BASH_COMPOUND_NODES])
            .filter((child) => findEnclosingFunction(child)?.id === node.id);
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
                            findEnclosingFunction(write)?.id === node.id &&
                            !ignored.some(
                                (part) => part.startIndex <= write.startIndex && part.endIndex >= write.endIndex,
                            ),
                    ).length,
            },
        ];
    });
}

// Keep code-unit positions and line breaks, and blank out the comment spans of the syntax tree.
function stripComments(text: string, comments: Node[]): string {
    const pieces: string[] = [];
    let offset = 0;
    for (const comment of comments) {
        pieces.push(
            text.slice(offset, comment.startIndex),
            convertToSpaces(text.slice(comment.startIndex, comment.endIndex)),
        );
        offset = comment.endIndex;
    }
    pieces.push(text.slice(offset));
    return pieces.join('');
}

// Only a direct mktemp command substitution owns the path assigned to this variable.
function isTemporaryValue(assignment: Node): boolean {
    const value = assignment.childForFieldName('value');
    if (value === null) return false;
    if (!TEMPORARY_VALUE_NODES.has(value.type)) return false;
    if (value.namedChildCount !== 1) return false;
    const substitution = [value, ...value.namedChildren].find(
        (candidate) => candidate.type === 'command_substitution' && candidate.namedChildCount === 1,
    );
    return substitution?.namedChild(0)?.childForFieldName('name')?.text === TEMPORARY_FILE_COMMAND;
}

// Bare local declarations can shadow a global temporary even without an assignment.
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
            const owner = findEnclosingFunction(declaration)?.id;
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

// Reassigning the same variable in its function makes a deferred cleanup target ambiguous.
function collectTemporaryTargets(root: Node): TemporaryTargets {
    const assignments = root.descendantsOfType('variable_assignment');
    const locals = listLocalNames(root);
    const counts = new Map<string, number>();
    const names = new Map<string, number>();
    for (const assignment of assignments) {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined) continue;
        const key = JSON.stringify([findEnclosingFunction(assignment)?.id, name]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        names.set(name, (names.get(name) ?? 0) + 1);
    }
    const targets = new Map<string, TemporaryPath>();
    const paths = assignments.flatMap((assignment) => {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined || !isTemporaryValue(assignment)) return [];
        const key = JSON.stringify([findEnclosingFunction(assignment)?.id, name]);
        const path: TemporaryPath = { name, line: assignment.startPosition.row + 1, cleanupLines: [] };
        const isUnique = locals.has(key) ? counts.get(key) === 1 : names.get(name) === 1;
        if (isUnique) targets.set(key, path);
        return [path];
    });
    return { paths, targets, declared: new Set([...counts.keys(), ...locals]) };
}

// A cleanup argument must contain only the temporary variable.
function findTemporaryTarget(
    argument: Node,
    owner: number | undefined,
    registry: TemporaryTargets,
): TemporaryPath | undefined {
    const references = argument.type === 'string' ? argument.namedChildren : [argument];
    if (references.length !== 1) return undefined;
    const reference = references.find((node) => EXPANSION_NODES.includes(node.type));
    if (reference === undefined) return undefined;
    const name = reference.namedChildren[0]?.text;
    if (name === undefined) return undefined;
    if (![`$${name}`, `\${${name}}`].includes(reference.text)) return undefined;
    const key = JSON.stringify([owner, name]);
    const target = registry.declared.has(key) ? key : JSON.stringify([undefined, name]);
    return registry.targets.get(target);
}

// All removals on a source line must target known temporaries before that line receives an exemption.
function recordRemovals(removals: Node[], context: CleanupContext): void {
    const { lineOffset, owner, registry, lines } = context;
    for (const removal of removals) {
        const targets = listRemovalTargets(removal);
        const line = lineOffset + removal.startPosition.row;
        const paths = targets.map((argument) => findTemporaryTarget(argument, owner, registry));
        lines.set(line, [...(lines.get(line) ?? []), ...(paths.length === 0 ? [undefined] : paths)]);
    }
}

// After --, arguments beginning with a dash also name removal targets.
function listRemovalTargets(command: Node): Node[] {
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

// Parse deferred trap bodies with the same grammar before treating any recursive removal as cleanup.
async function listTemporaryPaths(root: Node, commands: Node[], cache?: ParseCache): Promise<TemporaryPath[]> {
    const registry = collectTemporaryTargets(root);
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
            recordRemovals(removals, {
                lineOffset: body.startPosition.row + 1,
                owner: findEnclosingFunction(trap)?.id,
                registry: {
                    ...registry,
                    targets: new Map([...registry.targets].filter(([, path]) => !assigned.has(path.name))),
                },
                lines,
            });
        } finally {
            tree.delete();
        }
    }
    const safe = [...lines].filter(([, paths]) => !paths.includes(undefined));
    for (const [line, paths] of safe) {
        const known = paths.filter((path): path is TemporaryPath => path !== undefined);
        for (const path of known) path.cleanupLines.push(line);
    }
    return registry.paths;
}

/**
 * Parse comments, function ranges, calls, parameter reads, and file content through one Bash syntax tree.
 * @param text the exact source.
 * @param cache the parser state for this run.
 * @returns syntax data that stays valid after the tree goes away.
 */
export async function parseBashScript(text: string, cache?: ParseCache): Promise<ScriptSyntax> {
    const tree = await parseSource('bash', text, cache);
    try {
        const codeText = stripComments(text, tree.rootNode.descendantsOfType('comment'));

        const commands = tree.rootNode.descendantsOfType('command');

        const functions = parseBashFunctions(tree.rootNode, codeText);
        const calls = commands.flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            return name === undefined
                ? []
                : [{ name, count: node.childrenForFieldName('argument').length, line: node.startPosition.row + 1 }];
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
 * @param lines the masked code, split by row.
 * @returns trimmed code and one-based positions.
 */
export function listCodeLines(lines: string[]): NumberedLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : [{ number: index + 1, text: code }];
    });
}

/**
 * Read expansions of the environment names that the environment readers declare.
 * @param syntaxRoot the parsed Bash source.
 * @param owned the variables declared by environment readers.
 * @returns the environment reads and their source positions.
 */
export function readBashEnvironment(syntaxRoot: Node, owned: ReadonlySet<string>): EnvironmentRead[] {
    return syntaxRoot.descendantsOfType(['simple_expansion', 'expansion']).flatMap((expansion) =>
        expansion.namedChildren
            .filter((node) => node.type === 'variable_name' && owned.has(node.text))
            .map((node) => ({
                key: node.text,
                line: node.startPosition.row + 1,
                column: node.startPosition.column + 1,
            })),
    );
}
