import type { Node } from 'web-tree-sitter';
import { isDocstring } from '#cli/parsers/python.ts';

import {
    PYTHON_INTERFACE_BASES,
    PYTHON_ACCESSOR_DECORATOR,
    PYTHON_ABSTRACT_METACLASS,
    PYTHON_INTERFACE_DECORATORS,
} from '#cli/config/checks/structure.ts';

function listDecorators(node: Node): string[] {
    const parent = node.parent;
    if (parent?.type !== 'decorated_definition') return [];
    return parent.namedChildren
        .filter((child) => child.type === 'decorator')
        .map((decorator) => decorator.text.slice(1).split('(', 1)[0]?.trim() ?? '');
}

function readLastName(text: string): string {
    return text.split('.').at(-1) ?? '';
}

function findOwnerClass(node: Node): Node | undefined {
    const holder = node.parent?.type === 'decorated_definition' ? node.parent.parent : node.parent;
    return holder?.type === 'block' && holder.parent?.type === 'class_definition' ? holder.parent : undefined;
}

function isStub(node: Node): boolean {
    const statements = node.childForFieldName('body')?.namedChildren ?? [];
    return statements
        .filter((statement) => statement.type !== 'comment' && !isDocstring(statement, statements))
        .every(
            (statement) =>
                statement.type === 'pass_statement' ||
                (statement.type === 'expression_statement' && statement.namedChildren[0]?.type === 'ellipsis'),
        );
}

/**
 * Check whether a Python class declares an interface: it derives from Protocol or an abstract base class (ABC), or
 * the ABCMeta metaclass builds it.
 *
 * @param node the class definition.
 * @returns whether the class declares an interface.
 */
export function isInterfaceClass(node: Node): boolean {
    return (node.childForFieldName('superclasses')?.namedChildren ?? []).some((base) => {
        if (base.type === 'keyword_argument')
            return readLastName(base.childForFieldName('value')?.text ?? '') === PYTHON_ABSTRACT_METACLASS;
        const named = base.type === 'subscript' ? base.childForFieldName('value') : base;
        return PYTHON_INTERFACE_BASES.has(readLastName(named?.text ?? ''));
    });
}

/**
 * Check whether a Python function exists for its signature: an overload, an override, an abstract method, an
 * accessor, a method of an interface class, or a method stub.
 *
 * @param node the function definition.
 * @returns whether the function declares an interface rather than forwarding a call.
 */
export function isPythonInterface(node: Node): boolean {
    const decorators = listDecorators(node);
    if (
        decorators.some(
            (decorator) =>
                PYTHON_INTERFACE_DECORATORS.has(readLastName(decorator)) || PYTHON_ACCESSOR_DECORATOR.test(decorator),
        )
    )
        return true;
    const owner = findOwnerClass(node);
    return owner !== undefined && (isInterfaceClass(owner) || isStub(node));
}
