import type { Node } from 'web-tree-sitter';
import { findSourceLine } from '#cli/parsers/code/bash/commands.ts';
import { findFunctionNode } from '#cli/parsers/code/bash/functions.ts';
import type { Removal, TrapScript, TrapCleanup, TemporaryPath, ScriptTemporaryPaths } from '#cli/types/parsers.ts';

import {
    END_OF_OPTIONS,
    EXPANSION_NODES,
    REMOVE_FILE_COMMAND,
    TEMPORARY_VALUE_NODES,
    TEMPORARY_FILE_COMMAND,
    GLOBAL_DECLARATION_FLAG,
    LOCAL_DECLARATION_WORDS,
} from '#cli/config/parsers/code.ts';

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

export function listTemporaryPaths(syntaxRoot: Node, commands: Node[], traps: TrapScript[]): TemporaryPath[] {
    const temporaryPaths = buildScriptTemporaryPaths(syntaxRoot);
    const removers = commands.filter((command) => command.childForFieldName('name')?.text === REMOVE_FILE_COMMAND);
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
            .filter((command) => command.childForFieldName('name')?.text === REMOVE_FILE_COMMAND);
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
