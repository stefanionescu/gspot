import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import {
    CDK_PROPS_POSITION,
    POLICY_CONSTRUCT_KEYS,
    POLICY_DOCUMENT_FROM_JSON,
    POLICY_FROM_JSON,
    POLICY_JSON_KEYS,
    POLICY_STATEMENT,
    POLICY_STATEMENTS_KEY,
} from '../config/aws.ts';
import { UNDEFINED_NAME } from '../config/plugin.ts';
import { getExpressionValue, getOptionProperties, listArgumentValues } from '../language/expressions.ts';
import { getQualifiedName } from '../language/modules.ts';
import { getMemberRoot } from '../language/syntax.ts';
import type {
    CdkFinding,
    CdkIssue,
    CdkLiteralTarget,
    CdkPathResult,
    CdkPropertyCheck,
    CdkResult,
    CdkTarget,
    PolicyStatement,
} from '../types/aws.ts';

/**
Tell whether nothing in the file gives an expression a value. The expression, or the start of its member chain, names
an undeclared variable, or a variable without an import or a write, such as a parameter.
*/
function isUnresolved(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    const root = node && getMemberRoot(node);
    if (root?.type !== AST_NODE_TYPES.Identifier || root.name === UNDEFINED_NAME) return false;
    const variable = ASTUtils.findVariable(source.getScope(root), root);
    if (variable === null) return true;
    return (
        getQualifiedName(root, source) === undefined && variable.references.every((reference) => !reference.isWrite())
    );
}

function isEmptyValue(node: TSESTree.Node): boolean {
    const isUndefined = ASTUtils.isIdentifier(node) && node.name === UNDEFINED_NAME;
    const isEmptyList = node.type === AST_NODE_TYPES.ArrayExpression && node.elements.length === 0;
    return isUndefined || isEmptyList;
}

function listLiteralTargets(source: Readonly<TSESLint.SourceCode>, target: CdkTarget): CdkLiteralTarget[] {
    const value = getExpressionValue(target.value, source);
    if (value?.type === AST_NODE_TYPES.ObjectExpression) return [{ literal: value, report: target.report }];
    if (value?.type !== AST_NODE_TYPES.ArrayExpression) return [];
    return value.elements
        .filter((element) => element !== null)
        .flatMap((element) => listLiteralTargets(source, { value: element, report: element }));
}

function getPathStep(
    source: Readonly<TSESLint.SourceCode>,
    child: CdkLiteralTarget,
    path: readonly string[],
    check: { required: boolean; report: TSESTree.Node },
): CdkPathResult {
    const [key = '', ...rest] = path;
    const property = getOptionProperties(child.literal, source).get(key);
    if (property === undefined && check.required)
        return { targets: [], issues: [{ node: check.report, kind: 'omitted' }] };
    if (!property) return { targets: [], issues: [] };
    const isInline = child.literal === child.report && child.literal.properties.includes(property);
    const target = { value: property.value, report: isInline ? property.value : child.report };
    return rest.length > 0 ? listPathTargets(source, target, rest, check) : { targets: [target], issues: [] };
}

function listPathTargets(
    source: Readonly<TSESLint.SourceCode>,
    target: CdkTarget,
    path: readonly string[],
    check: Pick<CdkPropertyCheck, 'required'>,
): CdkPathResult {
    const literals = isUnresolved(source, target.value) ? [] : listLiteralTargets(source, target);
    const results = literals.map((child) =>
        getPathStep(source, child, path, { required: check.required, report: target.report }),
    );
    return {
        targets: results.flatMap(({ targets }) => targets),
        issues: results.flatMap(({ issues }) => issues),
    };
}

function isInvalidLiteral(value: TSESTree.Node, check: CdkPropertyCheck): boolean {
    if (value.type !== AST_NODE_TYPES.Literal) return false;
    const lowered = typeof value.value === 'string' ? value.value.toLowerCase() : value.value;
    const isListed = check.invalid?.some(
        (listed) => (typeof listed === 'string' ? listed.toLowerCase() : listed) === lowered,
    );
    return isListed === true || check.valid?.includes(value.value) === false;
}

function isInvalidName(source: Readonly<TSESLint.SourceCode>, value: TSESTree.Node, check: CdkPropertyCheck): boolean {
    const name = getCdkName(source, value);
    const isListed = name !== undefined && check.invalidNames?.includes(name) === true;
    return isListed || (check.validNames !== undefined && (name === undefined || !check.validNames.includes(name)));
}

function checkCdkValue(source: Readonly<TSESLint.SourceCode>, target: CdkTarget, check: CdkPropertyCheck): CdkIssue[] {
    const value = getExpressionValue(target.value, source) ?? target.value;
    if (isUnresolved(source, value)) return [];
    if (isEmptyValue(value)) return check.required ? [{ node: target.report, kind: 'omitted' }] : [];
    const isInvalid = isInvalidLiteral(value, check) || isInvalidName(source, value, check);
    return isInvalid ? [{ node: target.report, kind: 'invalid' }] : [];
}

function listDocumentStatements(source: Readonly<TSESLint.SourceCode>, document: TSESTree.Node): PolicyStatement[] {
    const statements = getCdkProperty(source, getCdkResult(source, document), POLICY_STATEMENTS_KEY);
    return listArgumentValues([statements.node], source).map((statement) => ({
        statement: getCdkResult(source, statement),
        keys: POLICY_JSON_KEYS,
    }));
}

function isAllowed(source: Readonly<TSESLint.SourceCode>, policy: PolicyStatement): boolean {
    const effect = getCdkProperty(source, policy.statement, policy.keys.effect);
    if (effect.status === 'missing') return true;
    const { node } = effect;
    const value = policy.keys.isJson ? node.type === AST_NODE_TYPES.Literal && node.value : getCdkName(source, node);
    return effect.status === 'found' && value === policy.keys.allow;
}

/**
Name the value of the cloud development kit that an expression reads, as `getQualifiedName` does. Each hyphen
becomes an underscore, so `aws-cdk-lib/aws-s3` and `aws_cdk_lib.aws_s3` read alike.
*/
export function getCdkName(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string | undefined {
    const name = node && getQualifiedName(node, source);
    if (name === undefined) return undefined;
    return name.replaceAll('-', '_');
}

export function listCdkIssues(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    check: CdkPropertyCheck,
): CdkIssue[] {
    const argument = node.arguments[check.position ?? CDK_PROPS_POSITION];
    if (argument === undefined || (ASTUtils.isIdentifier(argument) && argument.name === UNDEFINED_NAME))
        return check.required ? [{ node: node.callee, kind: 'omitted' }] : [];
    const { targets, issues } = listPathTargets(source, { value: argument, report: argument }, check.path, check);
    return [...issues, ...targets.flatMap((target) => checkCdkValue(source, target, check))];
}

/**
List the issues that the property checks of a table find in a call or a construction. The table maps the qualified
name of each construct or method of the cloud development kit to its checks. A call that spreads an argument has no
issues, because its arguments stay unknown.
*/
export function listCdkTableIssues(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    table: Readonly<Record<string, readonly CdkPropertyCheck[]>>,
): CdkFinding[] {
    const name = getCdkName(source, node.callee) ?? '';
    const checks = Object.hasOwn(table, name) ? table[name] : undefined;
    if (checks === undefined || node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement)) return [];
    return checks.flatMap((check) =>
        listCdkIssues(source, node, check).map((issue) => ({ ...issue, property: check.path.join('.') })),
    );
}

export function findBucketOption(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
    key: string,
): TSESTree.Property | null {
    return getOptionProperties(node.arguments[CDK_PROPS_POSITION], source).get(key) ?? null;
}

export function getCdkResult(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): CdkResult {
    const value = getExpressionValue(node, source) ?? node;
    const isUndefined = ASTUtils.isIdentifier(value) && value.name === UNDEFINED_NAME;
    return { status: isUndefined ? 'missing' : 'found', node: value };
}

export function getCdkArgument(source: Readonly<TSESLint.SourceCode>, result: CdkResult, position: number): CdkResult {
    const { node } = result;
    if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression)
        return { status: 'unknown', node };
    const argument = node.arguments[position];
    return argument === undefined ? { status: 'missing', node } : getCdkResult(source, argument);
}

export function getCdkProperty(source: Readonly<TSESLint.SourceCode>, result: CdkResult, key: string): CdkResult {
    const { node, status } = result;
    if (status !== 'found') return result;
    if (node.type !== AST_NODE_TYPES.ObjectExpression) return { status: 'unknown', node };
    const property = getOptionProperties(node, source).get(key);
    return property === undefined ? { status: 'missing', node } : getCdkResult(source, property.value);
}

export function listCdkStrings(source: Readonly<TSESLint.SourceCode>, result: CdkResult): TSESTree.StringLiteral[] {
    const { node } = result;
    const values = listArgumentValues([node], source);
    return values.filter(
        (value): value is TSESTree.StringLiteral =>
            value.type === AST_NODE_TYPES.Literal && typeof value.value === 'string',
    );
}

/**
List the statements of an identity and access management policy that a call or a construction makes, and that allow
their actions. A statement without an effect allows them too. The calls read `new iam.PolicyStatement(props)`,
`iam.PolicyStatement.fromJson(json)`, and `iam.PolicyDocument.fromJson(json)`, which makes each of its statements.
*/
export function listAllowStatements(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
): PolicyStatement[] {
    const name = getCdkName(source, node.callee);
    const [argument] = node.arguments;
    if (argument === undefined || node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement)) return [];
    const statement = getCdkResult(source, argument);
    let statements: PolicyStatement[] = [];
    if (node.type === AST_NODE_TYPES.NewExpression)
        statements = name === POLICY_STATEMENT ? [{ statement, keys: POLICY_CONSTRUCT_KEYS }] : [];
    else if (name === POLICY_FROM_JSON) statements = [{ statement, keys: POLICY_JSON_KEYS }];
    else if (name === POLICY_DOCUMENT_FROM_JSON) statements = listDocumentStatements(source, argument);
    return statements.filter((policy) => isAllowed(source, policy));
}
