import type { Node } from 'web-tree-sitter';
import { parseSource } from '#cli/parsers/tree-sitter.ts';
import { isTrivialFile, executableStatements } from '#cli/parsers/statements.ts';
import { DECLARATION_WORDS, LOCAL_DECLARATION_WORDS, ALL_POSITIONAL_PARAMETERS } from '#cli/config/parsers/bash.ts';

import type {
    CodeLine,
    ScriptSyntax,
    TemporaryPath,
    CleanupContext,
    BashParseOptions,
    TemporaryBindings,
} from '#cli/types/parsers/bash.ts';

// An inner function's parameters belong to it rather than to an enclosing function.
function functionOwner(node: Node): Node | undefined {
    let parent = node.parent;
    while (parent !== null) {
        if (parent.type === 'function_definition') return parent;
        parent = parent.parent;
    }
    return undefined;
}

function highestRead(node: Node): number {
    const expansions = node.descendantsOfType(['simple_expansion', 'expansion']);
    const positions = expansions.flatMap((expansion) => {
        if (functionOwner(expansion)?.id !== node.id) return [];
        const parameter = expansion.namedChildren[0]?.text;
        if (parameter === undefined) return [];
        if (ALL_POSITIONAL_PARAMETERS.has(parameter)) return [Number.POSITIVE_INFINITY];
        return /^[1-9]\d*$/u.test(parameter) ? [Number(parameter)] : [];
    });
    if (
        node
            .descendantsOfType('command')
            .some(
                (command) =>
                    functionOwner(command)?.id === node.id && command.childForFieldName('name')?.text === 'shift',
            )
    )
        return Number.POSITIVE_INFINITY;
    return Math.max(0, ...positions);
}

// Preserve code-unit positions and line breaks while removing the syntax tree's comment spans.
function maskComments(text: string, comments: Node[]): string {
    const pieces: string[] = [];
    let offset = 0;
    for (const comment of comments) {
        pieces.push(
            text.slice(offset, comment.startIndex),
            text
                .slice(comment.startIndex, comment.endIndex)
                .replaceAll(/[^\r\n]/gu, (character) => ' '.repeat(character.length)),
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
    if (!['string', 'command_substitution'].includes(value.type)) return false;
    if (value.namedChildCount !== 1) return false;
    const substitution = [value, ...value.namedChildren].find(
        (candidate) => candidate.type === 'command_substitution' && candidate.namedChildCount === 1,
    );
    return substitution?.namedChild(0)?.childForFieldName('name')?.text === 'mktemp';
}

// Bare local declarations can shadow a global temporary even without an assignment.
function localBindings(root: Node): Set<string> {
    const declarations = root
        .descendantsOfType('declaration_command')
        .filter(
            (declaration) =>
                LOCAL_DECLARATION_WORDS.has(declaration.child(0)?.text ?? '') &&
                !declaration.namedChildren.some((child) => child.text.startsWith('-') && child.text.includes('g')),
        );
    return new Set(
        declarations.flatMap((declaration) => {
            const owner = functionOwner(declaration)?.id;
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
function temporaryBindings(root: Node): TemporaryBindings {
    const assignments = root.descendantsOfType('variable_assignment');
    const locals = localBindings(root);
    const counts = new Map<string, number>();
    const names = new Map<string, number>();
    for (const assignment of assignments) {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined) continue;
        const key = JSON.stringify([functionOwner(assignment)?.id, name]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        names.set(name, (names.get(name) ?? 0) + 1);
    }
    const bindings = new Map<string, TemporaryPath>();
    const paths = assignments.flatMap((assignment) => {
        const name = assignment.childForFieldName('name')?.text;
        if (name === undefined || !isTemporaryValue(assignment)) return [];
        const key = JSON.stringify([functionOwner(assignment)?.id, name]);
        const path: TemporaryPath = { name, line: assignment.startPosition.row + 1, cleanupLines: [] };
        const isUnique = locals.has(key) ? counts.get(key) === 1 : names.get(name) === 1;
        if (isUnique) bindings.set(key, path);
        return [path];
    });
    return { paths, bindings, declared: new Set([...counts.keys(), ...locals]) };
}

// A cleanup argument must contain only the temporary variable.
function temporaryTarget(
    argument: Node,
    owner: number | undefined,
    registry: TemporaryBindings,
): TemporaryPath | undefined {
    const references = argument.type === 'string' ? argument.namedChildren : [argument];
    if (references.length !== 1) return undefined;
    const reference = references.find((node) => ['simple_expansion', 'expansion'].includes(node.type));
    if (reference === undefined) return undefined;
    const name = reference.namedChildren[0]?.text;
    if (name === undefined) return undefined;
    if (![`$${name}`, `\${${name}}`].includes(reference.text)) return undefined;
    const key = JSON.stringify([owner, name]);
    const target = registry.declared.has(key) ? key : JSON.stringify([undefined, name]);
    return registry.bindings.get(target);
}

// All removals on a source line must target known temporaries before that line receives an exemption.
function recordRemovals(removals: Node[], context: CleanupContext): void {
    const { lineOffset, owner, registry, lines } = context;
    for (const removal of removals) {
        const targets = removalTargets(removal);
        const line = lineOffset + removal.startPosition.row;
        const paths = targets.map((argument) => temporaryTarget(argument, owner, registry));
        lines.set(line, [...(lines.get(line) ?? []), ...(paths.length === 0 ? [undefined] : paths)]);
    }
}

// After --, even an argument beginning with a dash is a removal target.
function removalTargets(command: Node): Node[] {
    const targets: Node[] = [];
    let isOptions = true;
    for (const argument of command.childrenForFieldName('argument')) {
        if (isOptions && argument.text === '--') {
            isOptions = false;
            continue;
        }
        if (isOptions && argument.text.startsWith('-')) continue;
        targets.push(argument);
    }
    return targets;
}

// Parse deferred trap bodies with the same grammar before treating any recursive removal as cleanup.
async function temporaryCleanups(root: Node, commands: Node[], options: BashParseOptions): Promise<TemporaryPath[]> {
    const registry = temporaryBindings(root);
    const lines = new Map<number, Array<TemporaryPath | undefined>>(
        commands
            .filter((command) => command.childForFieldName('name')?.text === 'rm')
            .map((command) => [command.startPosition.row + 1, [undefined]]),
    );
    const traps = commands.filter((command) => command.childForFieldName('name')?.text === 'trap');
    for (const trap of traps) {
        const [body, ...signals] = trap.childrenForFieldName('argument').filter((argument) => argument.text !== '--');
        if (body?.type !== 'raw_string' || signals.length === 0) continue;
        const tree = await parseSource('bash', body.text.slice(1, -1), options.context);
        try {
            const assigned = new Set(
                tree.rootNode
                    .descendantsOfType('variable_assignment')
                    .map((assignment) => assignment.childForFieldName('name')?.text),
            );
            const removals = tree.rootNode
                .descendantsOfType('command')
                .filter((command) => command.childForFieldName('name')?.text === 'rm');
            recordRemovals(removals, {
                lineOffset: body.startPosition.row + 1,
                owner: functionOwner(trap)?.id,
                registry: {
                    ...registry,
                    bindings: new Map([...registry.bindings].filter(([, path]) => !assigned.has(path.name))),
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
 * @param text the exact source
 * @param options the selected size floor and run-owned parser resources
 * @returns syntax data that remains valid after the tree is disposed
 */
export async function parseBashScript(text: string, options: BashParseOptions): Promise<ScriptSyntax> {
    const tree = await parseSource('bash', text, options.context);
    try {
        const comments = tree.rootNode.descendantsOfType('comment');
        const codeText = maskComments(text, comments);
        const code = codeText.split('\n');
        const functions = tree.rootNode.descendantsOfType('function_definition').flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            const body = node.childForFieldName('body');
            if (name === undefined || body === null) return [];
            const start = node.startPosition.row + 1;
            const end = node.endPosition.row + 1;
            return [
                {
                    name,
                    start,
                    end,
                    body: codeText.slice(body.startIndex + 1, body.endIndex - 1).split('\n'),
                    statements: executableStatements(body.namedChildren, 'bash'),
                    highestRead: highestRead(node),
                },
            ];
        });
        const commands = tree.rootNode.descendantsOfType('command');
        const calls = commands.flatMap((node) => {
            const name = node.childForFieldName('name')?.text;
            return name === undefined
                ? []
                : [{ name, count: node.childrenForFieldName('argument').length, line: node.startPosition.row + 1 }];
        });
        const quotedArguments = commands.flatMap((node) => {
            const command = node.childForFieldName('name')?.text;
            if (command === undefined) return [];
            return node
                .childrenForFieldName('argument')
                .filter(
                    (argument) =>
                        (argument.type === 'string' || argument.type === 'raw_string') &&
                        argument.endPosition.row > argument.startPosition.row,
                )
                .map((argument) => ({
                    command,
                    start: argument.startPosition.row + 1,
                    end: argument.endPosition.row + 1,
                }));
        });
        return {
            code,
            functions,
            calls,
            quotedArguments,
            temporaryPaths: await temporaryCleanups(tree.rootNode, commands, options),
            isTrivialFile:
                options.minimumStatements !== undefined &&
                isTrivialFile(tree.rootNode, 'bash', options.minimumStatements),
        };
    } finally {
        tree.delete();
    }
}

/**
 * Select non-blank code lines after the parser has masked comments.
 * @param lines the parsed code lines
 * @returns trimmed code and one-based positions
 */
export function codeLines(lines: string[]): CodeLine[] {
    return lines.flatMap((line, index) => {
        const code = line.trim();
        return code === '' ? [] : [{ number: index + 1, code }];
    });
}

/**
 * Remove a declaration word and its flags. Retain the assignment or command.
 * @param code a comment-free code line
 * @returns the value after export, readonly, local, declare, or typeset
 */
export function withoutDeclaration(code: string): string {
    const words = code.split(/\s+/u);
    if (!DECLARATION_WORDS.has(words[0] ?? '')) return code;
    let index = 1;
    while ((words[index] ?? '').startsWith('-')) index += 1;
    return words.slice(index).join(' ');
}
