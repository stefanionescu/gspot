import { createRule } from '../rule.ts';
import { LOOP_BODY_PARENTS } from '../config/builtins.ts';
import { ASTUtils, TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import type { PathFrame, ValueState, SegmentFlow, AssignedValues, AssignmentFrame } from '../types/rules.ts';

function findNamedVariable(name: string, scope: TSESLint.Scope.Scope): TSESLint.Scope.Variable | undefined {
    const variables = [...scope.variables, ...(scope.upper?.variables ?? [])];
    return variables.find((variable) => variable.name === name);
}

function readAssignedValues(
    variable: TSESLint.Scope.Variable,
    value: TSESTree.Node | null | undefined,
    state: ValueState,
    scope: TSESLint.Scope.Scope,
): AssignedValues {
    if (value?.type === AST_NODE_TYPES.Literal) return new Set([value.raw]);
    if (value?.type !== AST_NODE_TYPES.Identifier) return null;
    const named = findNamedVariable(value.name, scope);
    return named === undefined || Object.is(named, variable) ? null : (state.get(named) ?? null);
}

function joinValues(held: AssignedValues | undefined, values: AssignedValues): AssignedValues {
    if (held === null || values === null) return null;
    return new Set([...(held ?? []), ...values]);
}

function joinStates(states: readonly ValueState[]): ValueState {
    const joined: ValueState = new Map();
    for (const state of states)
        for (const [variable, values] of state) joined.set(variable, joinValues(joined.get(variable), values));
    return joined;
}

function haveSameValues(first: ValueState, second: ValueState): boolean {
    if (first.size !== second.size) return false;
    return [...first].every(([variable, values]) => {
        const other = second.get(variable);
        if (other === undefined || values === null || other === null) return Object.is(values, other);
        return values.size === other.size && [...values].every((value) => other.has(value));
    });
}

function propagate(flow: SegmentFlow, flows: ReadonlyMap<string, SegmentFlow>): boolean {
    const incoming = joinStates(flow.segment.prevSegments.map(({ id }) => flows.get(id)?.outgoing ?? new Map()));
    const outgoing = new Map(incoming);
    for (const reference of flow.references) {
        const { resolved, writeExpr, from } = reference;
        if (resolved !== null && reference.isWrite())
            outgoing.set(resolved, readAssignedValues(resolved, writeExpr, outgoing, from));
    }
    flow.incoming = incoming;
    const isChanged = !haveSameValues(flow.outgoing, outgoing);
    if (isChanged) flow.outgoing = outgoing;
    return isChanged;
}

function solveFlows(flows: ReadonlyMap<string, SegmentFlow>): void {
    const pending = [...flows.values()].map(({ segment }) => segment);
    for (let segment = pending.pop(); segment !== undefined; segment = pending.pop()) {
        const flow = flows.get(segment.id);
        if (flow !== undefined && propagate(flow, flows)) pending.push(...segment.nextSegments);
    }
}

function listLocalPairs(node: TSESTree.Node, source: TSESLint.SourceCode): [TSESTree.Node, TSESTree.Node][] {
    const ancestors = source.getAncestors(node);
    const chain = [...ancestors.slice(ancestors.findLastIndex((ancestor) => ASTUtils.isFunction(ancestor)) + 1), node];
    return chain.slice(1).flatMap((child, index): [TSESTree.Node, TSESTree.Node][] => {
        const parent = chain[index];
        return parent === undefined ? [] : [[parent, child]];
    });
}

function isRewrite(value: TSESTree.Node, reference: TSESLint.Scope.Reference): boolean {
    const { parent } = value;
    const isCompound = parent?.type === AST_NODE_TYPES.AssignmentExpression && parent.operator !== '=';
    return (
        isCompound ||
        (ASTUtils.isIdentifier(value) && Object.is(findNamedVariable(value.name, reference.from), reference.resolved))
    );
}

function isLoopSetup(reference: TSESLint.Scope.Reference, value: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const isInit = listLocalPairs(value, source).some(
        ([parent, child]) => parent.type === AST_NODE_TYPES.ForStatement && Object.is(parent.init, child),
    );
    if (isInit) return true;
    const definition = reference.resolved?.defs.find(
        ({ type, node, name }) =>
            type === TSESLint.Scope.DefinitionType.Variable &&
            node.init !== null &&
            Object.is(name, reference.identifier),
    );
    const declaration = definition?.node.parent;
    if (declaration?.type !== AST_NODE_TYPES.VariableDeclaration) return false;
    return listLocalPairs(declaration, source).some(
        ([parent, child]) => LOOP_BODY_PARENTS.has(parent.type) && 'body' in parent && Object.is(parent.body, child),
    );
}

function isExcludedWrite(reference: TSESLint.Scope.Reference, source: TSESLint.SourceCode): boolean {
    if (reference.identifier.parent.type === AST_NODE_TYPES.AssignmentPattern) return true;
    const value = reference.writeExpr ?? undefined;
    return value !== undefined && (isRewrite(value, reference) || isLoopSetup(reference, value, source));
}

function isReportable(
    reference: TSESLint.Scope.Reference,
    usages: ReadonlyMap<TSESLint.Scope.Variable, ReadonlySet<string>>,
    source: TSESLint.SourceCode,
): boolean {
    const variable = reference.resolved;
    if (variable === null || variable.name.startsWith('_') || (usages.get(variable)?.size ?? 0) > 1) return false;
    const isUnset = variable.defs.some(
        ({ type, node }) =>
            type === TSESLint.Scope.DefinitionType.Parameter ||
            (type === TSESLint.Scope.DefinitionType.Variable && node.init === null),
    );
    return !isUnset && !isExcludedWrite(reference, source);
}

function isRepeatedValue(held: AssignedValues | undefined, assigned: AssignedValues): boolean {
    if (held === undefined || held === null || assigned === null) return false;
    const [first] = held;
    return held.size === 1 && assigned.size === 1 && first !== undefined && assigned.has(first);
}

function listRedundantWrites(
    flow: SegmentFlow,
    usages: ReadonlyMap<TSESLint.Scope.Variable, ReadonlySet<string>>,
    source: TSESLint.SourceCode,
): TSESLint.Scope.Reference[] {
    const state = new Map(flow.incoming);
    const redundant: TSESLint.Scope.Reference[] = [];
    for (const reference of flow.references) {
        const { resolved: variable, writeExpr, from } = reference;
        if (variable === null || !reference.isWrite() || !isReportable(reference, usages, source)) continue;
        const assigned = readAssignedValues(variable, writeExpr, state, from);
        const writes = variable.references.filter((each) => each.isWrite()).length;
        if (writes > 1 && isRepeatedValue(state.get(variable), assigned)) redundant.push(reference);
        state.set(variable, assigned);
    }
    return redundant;
}

function addToAssignment(
    assignment: AssignmentFrame,
    reference: TSESLint.Scope.Reference,
    source: TSESLint.SourceCode,
): void {
    const { node } = assignment;
    const [left, right] =
        node.type === AST_NODE_TYPES.AssignmentExpression ? [node.left, node.right] : [node.id, node.init];
    const chain = [...source.getAncestors(reference.identifier), reference.identifier];
    const side = chain.findLast((node) => Object.is(node, left) || Object.is(node, right));
    if (side !== undefined) (Object.is(side, left) ? assignment.left : assignment.right).add(reference);
}

function indexIdentifiers(
    source: TSESLint.SourceCode,
    references: Map<TSESTree.Node, TSESLint.Scope.Reference>,
    definitions: Map<TSESTree.Node, TSESLint.Scope.Variable>,
): void {
    for (const scope of source.scopeManager?.scopes ?? []) {
        for (const reference of scope.references) references.set(reference.identifier, reference);
        for (const variable of scope.variables) for (const { name } of variable.defs) definitions.set(name, variable);
    }
}

function processReference(
    reference: TSESLint.Scope.Reference,
    frame: PathFrame | undefined,
    flows: ReadonlyMap<string, SegmentFlow>,
    source: TSESLint.SourceCode,
): void {
    const assignment = frame?.assignments.at(-1);
    if (assignment !== undefined) {
        addToAssignment(assignment, reference, source);
        return;
    }
    if (reference.resolved === null) return;
    for (const { id } of frame?.segments ?? []) flows.get(id)?.references.add(reference);
}

function recordUsage(
    usages: Map<TSESLint.Scope.Variable, Set<string>>,
    variable: TSESLint.Scope.Variable | undefined,
    frame: PathFrame | undefined,
): void {
    if (variable === undefined || frame === undefined) return;
    const used = usages.get(variable) ?? new Set<string>();
    usages.set(variable, used.add(frame.codePath.id));
}

export const noRedundantAssignment = createRule<[], 'redundant'>({
    name: 'no-redundant-assignment',
    meta: {
        defaultOptions: [],
        type: 'suggestion',
        docs: {
            level: 'recommended',
            description:
                'Reports an assignment of a literal, or of a variable that holds one literal, to a variable that already holds that same literal on every path that reaches the assignment. The rule follows the code paths of one function, and skips variables declared without a value, parameters, names that start with `_`, compound assignments, loop setups, and variables that another function also uses.',
            why: 'An assignment that cannot change the value suggests that the code meant to assign something else, and it hides which value the code relies on.',
            fix: 'Remove the assignment, or assign the value that the code meant to store.',
            example: '`let mode = "fast"; if (ready) mode = "fast";` reports `redundant` at the second `"fast"`.',
        },
        schema: [],
        messages: { redundant: '{{name}} already holds this value on every path that reaches here.' },
    },
    create(context) {
        const source = context.sourceCode;
        const flows = new Map<string, SegmentFlow>();
        const usages = new Map<TSESLint.Scope.Variable, Set<string>>();
        const references = new Map<TSESTree.Node, TSESLint.Scope.Reference>();
        const definitions = new Map<TSESTree.Node, TSESLint.Scope.Variable>();
        const frames: PathFrame[] = [];
        let enumDepth = 0;
        return {
            Program: () => {
                indexIdentifiers(source, references, definitions);
            },
            onCodePathStart: (codePath: TSESLint.CodePath) => frames.push({ codePath, assignments: [], segments: [] }),
            onCodePathEnd: () => frames.pop(),
            onCodePathSegmentStart: (segment: TSESLint.CodePathSegment) => {
                flows.set(segment.id, { segment, incoming: new Map(), outgoing: new Map(), references: new Set() });
                frames.at(-1)?.segments.push(segment);
            },
            onCodePathSegmentEnd: () => frames.at(-1)?.segments.pop(),
            TSEnumDeclaration: () => (enumDepth += 1),
            'TSEnumDeclaration:exit': () => (enumDepth -= 1),
            ':matches(AssignmentExpression, VariableDeclarator[init])': (node: AssignmentFrame['node']) =>
                frames.at(-1)?.assignments.push({ node, left: new Set(), right: new Set() }),
            ':matches(AssignmentExpression, VariableDeclarator[init]):exit': () => {
                const assignment = frames.at(-1)?.assignments.pop();
                for (const reference of [...(assignment?.right ?? []), ...(assignment?.left ?? [])])
                    processReference(reference, frames.at(-1), flows, source);
            },
            Identifier: (node) => {
                if (enumDepth > 0) return;
                const reference = references.get(node);
                if (reference !== undefined) processReference(reference, frames.at(-1), flows, source);
                const variable = reference === undefined ? definitions.get(node) : (reference.resolved ?? undefined);
                recordUsage(usages, variable, frames.at(-1));
            },
            'Program:exit': () => {
                solveFlows(flows);
                const redundant = [...flows.values()].flatMap((flow) => listRedundantWrites(flow, usages, source));
                for (const { identifier, writeExpr } of redundant)
                    context.report({
                        node: writeExpr ?? identifier,
                        messageId: 'redundant',
                        data: { name: identifier.name },
                    });
            },
        };
    },
});
