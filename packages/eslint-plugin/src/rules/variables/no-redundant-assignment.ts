import { AST_NODE_TYPES, ASTUtils, TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { LOOP_BODY_PARENTS } from '../../config/plugin.ts';
import { listFunctionAncestors } from '../../language/functions.ts';
import { createRule } from '../../rule.ts';
import type { AssignedValues, AssignmentFrame, PathFrame, SegmentFlow, ValueState } from '../../types/variables.ts';

function getAssignedValues(
    value: TSESTree.Node | null | undefined,
    state: ValueState,
    scope: TSESLint.Scope.Scope,
): AssignedValues {
    if (value?.type === AST_NODE_TYPES.Literal) return new Set([value.raw]);
    return value?.type === AST_NODE_TYPES.Identifier
        ? (state.get(ASTUtils.findVariable(scope, value.name)) ?? null)
        : null;
}

function joinStates(states: readonly ValueState[]): ValueState {
    const joined: ValueState = new Map();
    for (const state of states)
        for (const [variable, values] of state) {
            const held = joined.get(variable);
            joined.set(variable, held === null || values === null ? null : new Set([...(held ?? []), ...values]));
        }
    return joined;
}

function haveSameValues(first: ValueState, second: ValueState): boolean {
    if (first.size !== second.size) return false;
    return [...first].every(([variable, values]) => {
        const other = second.get(variable);
        return other === undefined || values === null || other === null
            ? Object.is(values, other)
            : values.size === other.size && values.isSubsetOf(other);
    });
}

function buildOutgoing(flow: SegmentFlow): ValueState {
    const outgoing = new Map(flow.incoming);
    for (const reference of flow.references) {
        const { resolved, writeExpr, from } = reference;
        if (resolved !== null && reference.isWrite())
            outgoing.set(resolved, getAssignedValues(writeExpr, outgoing, from));
    }
    return outgoing;
}

function solveFlows(flows: ReadonlyMap<string, SegmentFlow>): void {
    const pending = flows
        .values()
        .map(({ segment }) => segment)
        .toArray();
    for (let segment = pending.pop(); segment !== undefined; segment = pending.pop()) {
        const flow = flows.get(segment.id);
        if (flow === undefined) continue;
        const states = flow.segment.prevSegments.map(({ id }) => flows.get(id)?.outgoing);
        flow.incoming = joinStates(states.filter((state) => state !== undefined));
        const outgoing = buildOutgoing(flow);
        if (haveSameValues(flow.outgoing, outgoing)) continue;
        flow.outgoing = outgoing;
        pending.push(...segment.nextSegments);
    }
}

function isRewrite(value: TSESTree.Node, reference: TSESLint.Scope.Reference): boolean {
    const { parent } = value;
    const isCompound = parent?.type === AST_NODE_TYPES.AssignmentExpression && parent.operator !== '=';
    return (
        isCompound ||
        (ASTUtils.isIdentifier(value) &&
            Object.is(ASTUtils.findVariable(reference.from, value.name), reference.resolved))
    );
}

function isLoopSetup(reference: TSESLint.Scope.Reference, value: TSESTree.Node, source: TSESLint.SourceCode): boolean {
    const isInit = listFunctionAncestors(value, source).some(
        (child) => child.parent?.type === AST_NODE_TYPES.ForStatement && Object.is(child.parent.init, child),
    );
    if (isInit) return true;
    const definition = reference.resolved?.defs.find(
        ({ type, node, name }) =>
            type === TSESLint.Scope.DefinitionType.Variable &&
            node.init !== null &&
            Object.is(name, reference.identifier),
    );
    const declaration = definition?.node.parent;
    return (
        declaration?.type === AST_NODE_TYPES.VariableDeclaration &&
        listFunctionAncestors(declaration, source).some(({ type }) => LOOP_BODY_PARENTS.has(type))
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
    if (variable === null || variable.name.startsWith('_') || usages.get(variable)?.size !== 1) return false;
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
): Array<TSESLint.ReportDescriptor<'redundant'>> {
    const state = new Map(flow.incoming);
    const redundant: Array<TSESLint.ReportDescriptor<'redundant'>> = [];
    for (const reference of flow.references) {
        const { resolved: variable, writeExpr, from } = reference;
        if (variable === null || !reference.isWrite() || !isReportable(reference, usages, source)) continue;
        const assigned = getAssignedValues(writeExpr, state, from);
        const writes = variable.references.filter((each) => each.isWrite()).length;
        if (writeExpr && writes > 1 && isRepeatedValue(state.get(variable), assigned))
            redundant.push({ node: writeExpr, messageId: 'redundant', data: { name: variable.name } });
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
    const scopes = source.scopeManager?.scopes ?? [];
    for (const scope of scopes)
        for (const reference of scope.references) references.set(reference.identifier, reference);
    const variables = scopes.flatMap((scope) => scope.variables);
    for (const variable of variables) for (const { name } of variable.defs) definitions.set(name, variable);
}

function addReference(
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
    const segments = frame?.segments ?? [];
    for (const { id } of segments) flows.get(id)?.references.add(reference);
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
                'Reports an assignment of a literal to a variable that already holds that same literal on every code path that reaches the assignment.',
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
        return {
            Program: () => {
                indexIdentifiers(source, references, definitions);
            },
            onCodePathStart: (codePath: TSESLint.CodePath) => {
                frames.push({ codePath, assignments: [], segments: [] });
            },
            onCodePathEnd: () => frames.pop(),
            onCodePathSegmentStart: (segment: TSESLint.CodePathSegment) => {
                flows.set(segment.id, { segment, incoming: new Map(), outgoing: new Map(), references: new Set() });
                frames.at(-1)?.segments.push(segment);
            },
            onCodePathSegmentEnd: () => frames.at(-1)?.segments.pop(),
            ':matches(AssignmentExpression, VariableDeclarator[init])': (node: AssignmentFrame['node']) => {
                frames.at(-1)?.assignments.push({ node, left: new Set(), right: new Set() });
            },
            ':matches(AssignmentExpression, VariableDeclarator[init]):exit': () => {
                const assignment = frames.at(-1)?.assignments.pop();
                if (assignment === undefined) return;
                for (const reference of [...assignment.right, ...assignment.left])
                    addReference(reference, frames.at(-1), flows, source);
            },
            Identifier: (node) => {
                const reference = references.get(node);
                if (reference !== undefined) addReference(reference, frames.at(-1), flows, source);
                const variable = reference === undefined ? definitions.get(node) : (reference.resolved ?? undefined);
                recordUsage(usages, variable, frames.at(-1));
            },
            'Program:exit': () => {
                solveFlows(flows);
                const redundant = flows.values().flatMap((flow) => listRedundantWrites(flow, usages, source));
                for (const report of redundant) context.report(report);
            },
        };
    },
});
