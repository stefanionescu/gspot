import { UNDEFINED_NAME } from '../config/plugin.ts';
import { getQualifiedName } from '../language/modules.ts';
import { ASTUtils, type TSESLint, type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/utils';
import { listArgumentValues, getExpressionValue, getOptionProperties } from '../language/expressions.ts';

import type {
    CdkIssue,
    CdkResult,
    CdkTarget,
    CdkFinding,
    CdkPathResult,
    PolicyStatement,
    CdkLiteralTarget,
    CdkPropertyCheck,
} from '../types/aws.ts';
import {
    S3_BUCKET,
    POLICY_FROM_JSON,
    POLICY_JSON_KEYS,
    POLICY_STATEMENT,
    CDK_PROPS_POSITION,
    POLICY_CONSTRUCT_KEYS,
    POLICY_STATEMENTS_KEY,
    POLICY_DOCUMENT_FROM_JSON,
} from '../config/aws.ts';

/**
Name the value of the cloud development kit that an expression reads, as `getQualifiedName` does. Each hyphen
becomes an underscore, so `aws-cdk-lib/aws-s3` and `aws_cdk_lib.aws_s3` read alike.

@param source the source code of the file.
@param node the expression to name.
@returns the dotted name, or undefined when the value has none.
*/
export function getCdkName(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): string | undefined {
    const name = node && getQualifiedName(node, source);
    if (name === undefined) return undefined;
    return name.replaceAll('-', '_');
}

/**
Tell whether nothing in the file gives an expression a value. The expression, or the start of its member chain, names
an undeclared variable, or a variable without an import or a write, such as a parameter.

@param source the source code of the file.
@param node the expression to check.
*/
function isUnresolved(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node | undefined): boolean {
    let root = node;
    while (root?.type === AST_NODE_TYPES.MemberExpression) root = root.object;
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
    return rest.length > 0 ? listPathTargets(source, target, rest, check.required) : { targets: [target], issues: [] };
}

function listPathTargets(
    source: Readonly<TSESLint.SourceCode>,
    target: CdkTarget,
    path: readonly string[],
    required: boolean,
): CdkPathResult {
    const literals = isUnresolved(source, target.value) ? [] : listLiteralTargets(source, target);
    const results = literals.map((child) => getPathStep(source, child, path, { required, report: target.report }));
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

/**
List the issues of one property in the options of a construct or a method of the cloud development kit. The options
may lack a required property, or hold a value that the check rejects.

@param source the source code of the file.
@param node the construction or the method call.
@param check the argument position, the property path, and the values to reject or require.
@returns each node to report, and whether the options omit its property or give it an invalid value.
*/
export function listCdkIssues(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.CallExpression | TSESTree.NewExpression,
    check: CdkPropertyCheck,
): CdkIssue[] {
    const argument = node.arguments[check.position ?? CDK_PROPS_POSITION];
    if (argument === undefined || (ASTUtils.isIdentifier(argument) && argument.name === UNDEFINED_NAME))
        return check.required ? [{ node: node.callee, kind: 'omitted' }] : [];
    const { targets, issues } = listPathTargets(
        source,
        { value: argument, report: argument },
        check.path,
        check.required,
    );
    return [...issues, ...targets.flatMap((target) => checkCdkValue(source, target, check))];
}

/**
List the issues that the property checks of a table find in a call or a construction. The table maps the qualified
name of each construct or method of the cloud development kit to its checks. A call that spreads an argument has no
issues, because its arguments stay unknown.

@param source the source code of the file.
@param node the call or the construction.
@param table the property checks of each qualified name, with hyphens written as underscores.
@returns each node to report, whether the options omit its property or give it an invalid value, and the property name.
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

/**
Find a property of the options that an S3 construct, such as `new s3.Bucket(scope, id, options)`, receives, by its
identifier key.

@param source the source code of the file.
@param node the construction.
@param key the name of the option.
@returns the property, or null when the options lack the key or hold no object literal.
*/
export function findBucketOption(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
    key: string,
): TSESTree.Property | null {
    const options = getExpressionValue(node.arguments[CDK_PROPS_POSITION], source);
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return null;
    const property = options.properties.find(
        (child): child is TSESTree.Property =>
            child.type === AST_NODE_TYPES.Property && ASTUtils.isIdentifier(child.key) && child.key.name === key,
    );
    return property ?? null;
}

/**
Find a boolean option of an S3 bucket construction that the options leave out or set to `false`.

@param source the source code of the file.
@param node the construction.
@param key the name of the option.
@returns the node to report and whether the options omit the option or turn it off, or undefined for an option
turned on or a construction of another class.
*/
export function findDisabledBucketOption(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
    key: string,
): CdkIssue | undefined {
    if (getCdkName(source, node) !== S3_BUCKET) return undefined;
    const option = findBucketOption(source, node, key);
    if (option === null) return { node: node.callee, kind: 'omitted' };
    const value = getExpressionValue(option.value, source);
    return value?.type === AST_NODE_TYPES.Literal && value.value === false
        ? { node: option, kind: 'invalid' }
        : undefined;
}

/**
Get the value of an expression, after following identifiers to their written values.

@param source the source code of the file.
@param node the expression.
@returns the value, `missing` for `undefined`.
*/
export function getCdkResult(source: Readonly<TSESLint.SourceCode>, node: TSESTree.Node): CdkResult {
    const value = getExpressionValue(node, source) ?? node;
    const isUndefined = ASTUtils.isIdentifier(value) && value.name === UNDEFINED_NAME;
    return { status: isUndefined ? 'missing' : 'found', node: value };
}

/**
Get an argument of the call or the construction that a result holds.

@param source the source code of the file.
@param result the call or the construction.
@param position the index of the argument.
@returns the argument value, `missing` when the call has no such argument, or `unknown` when the result holds no call.
*/
export function getCdkArgument(source: Readonly<TSESLint.SourceCode>, result: CdkResult, position: number): CdkResult {
    const { node } = result;
    if (node.type !== AST_NODE_TYPES.CallExpression && node.type !== AST_NODE_TYPES.NewExpression)
        return { status: 'unknown', node };
    const argument = node.arguments[position];
    return argument === undefined ? { status: 'missing', node } : getCdkResult(source, argument);
}

/**
Get a property of the object literal that a result holds.

@param source the source code of the file.
@param result the object.
@param key the property name.
@returns the property value, `missing` when the object lacks the key, or `unknown` when the result holds no object
literal.
*/
export function getCdkProperty(source: Readonly<TSESLint.SourceCode>, result: CdkResult, key: string): CdkResult {
    const { node, status } = result;
    if (status !== 'found') return result;
    if (node.type !== AST_NODE_TYPES.ObjectExpression) return { status: 'unknown', node };
    const property = getOptionProperties(node, source).get(key);
    return property === undefined ? { status: 'missing', node } : getCdkResult(source, property.value);
}

/**
Get the literal value that a result holds.

@param result the value.
@returns the value of the literal, or undefined when the result holds no literal.
*/
export function getCdkLiteral(result: CdkResult): unknown {
    const { node, status } = result;
    if (status !== 'found' || node.type !== AST_NODE_TYPES.Literal) return undefined;
    return node.value;
}

/**
List the string literals that a result holds, as one value or as the elements of an array.

@param source the source code of the file.
@param result the string or the array.
@returns the string literals, after following identifiers to their written values.
*/
export function listCdkStrings(source: Readonly<TSESLint.SourceCode>, result: CdkResult): TSESTree.StringLiteral[] {
    const { node } = result;
    const values = listArgumentValues([node], source);
    return values.filter(
        (value): value is TSESTree.StringLiteral =>
            value.type === AST_NODE_TYPES.Literal && typeof value.value === 'string',
    );
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
List the statements of an identity and access management policy that a call or a construction makes, and that allow
their actions. A statement without an effect allows them too. The calls read `new iam.PolicyStatement(props)`,
`iam.PolicyStatement.fromJson(json)`, and `iam.PolicyDocument.fromJson(json)`, which makes each of its statements.

@param source the source code of the file.
@param node the call or the construction.
@returns each statement with the property names of its format.
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
