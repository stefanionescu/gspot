import { AST_NODE_TYPES, ASTUtils, type TSESLint, type TSESTree } from '@typescript-eslint/utils';

import { CDK_PROPS_POSITION, KMS_KEYS, RDS_KEYED_STORAGES, RDS_STORAGES } from '../../config/aws.ts';
import { getExpressionValue, getOptionProperties } from '../../language/expressions.ts';
import { getCdkName } from '../../libraries/aws.ts';
import { createRule } from '../../rule.ts';
import type { StorageIssue } from '../../types/aws.ts';

function hasKmsKey(source: Readonly<TSESLint.SourceCode>, options: TSESTree.ObjectExpression): boolean {
    const key = getOptionProperties(options, source).get('storageEncryptionKey');
    const value = key ? getExpressionValue(key.value, source) : undefined;
    return value?.type === AST_NODE_TYPES.NewExpression && KMS_KEYS.has(getCdkName(source, value.callee));
}

function findUnencryptedStorage(
    source: Readonly<TSESLint.SourceCode>,
    options: TSESTree.ObjectExpression,
): StorageIssue | undefined {
    const encrypted = getOptionProperties(options, source).get('storageEncrypted');
    if (encrypted === undefined) return { node: options, messageId: 'omitted' };
    const value = getExpressionValue(encrypted.value, source);
    return value?.type === AST_NODE_TYPES.Literal && value.value === false
        ? { node: value, messageId: 'unencrypted' }
        : undefined;
}

function getStorageOptions(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
): TSESTree.Node | undefined {
    const argument = node.arguments[CDK_PROPS_POSITION];
    if (argument === undefined) return undefined;
    return getExpressionValue(argument, source) ?? argument;
}

function findStorageIssue(
    source: Readonly<TSESLint.SourceCode>,
    node: TSESTree.NewExpression,
): StorageIssue | undefined {
    const name = getCdkName(source, node.callee);
    const options = getStorageOptions(source, node);
    if (!RDS_STORAGES.has(name) || (ASTUtils.isIdentifier(options) && options.name !== 'undefined')) return undefined;
    if (options?.type !== AST_NODE_TYPES.ObjectExpression) return { node: node.callee, messageId: 'omitted' };
    return RDS_KEYED_STORAGES.has(name) && hasKmsKey(source, options)
        ? undefined
        : findUnencryptedStorage(source, options);
}

export const awsRdsUnencryptedDatabases = createRule<[], 'omitted' | 'unencrypted'>({
    name: 'aws-rds-unencrypted-databases',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description:
                'Finds RDS database and cluster constructions that leave out `storageEncrypted` or set it to `false`, unless a KMS key or alias passed as `storageEncryptionKey` turns the encryption on.',
            why: 'An unencrypted database exposes its data to anyone who gets a copy of its storage, snapshots, or backups.',
            fix: 'Set `storageEncrypted: true`, or pass a KMS key as `storageEncryptionKey`.',
            example:
                'The construction `new rds.DatabaseInstance(this, "Db", { engine, vpc })` reports `omitted`. Add `storageEncrypted: true`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out storageEncrypted stores this database unencrypted. Set storageEncrypted to true.',
            unencrypted: 'This database is stored unencrypted. Set storageEncrypted to true.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const isSpread = node.arguments.some(({ type }) => type === AST_NODE_TYPES.SpreadElement);
                const issue = isSpread ? undefined : findStorageIssue(source, node);
                if (issue) context.report(issue);
            },
        };
    },
});
