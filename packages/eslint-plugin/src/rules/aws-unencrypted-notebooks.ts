import { createRule } from '../rule.ts';
import { listCdkTableIssues } from '../aws.ts';
import { SAGEMAKER_NOTEBOOK_CHECKS } from '../config/aws.ts';

export const awsUnencryptedNotebooks = createRule<[], 'omitted'>({
    name: 'aws-unencrypted-notebooks',
    meta: {
        defaultOptions: [],
        type: 'problem',
        docs: {
            level: 'recommended',
            description: 'Finds `new sagemaker.CfnNotebookInstance` constructions without a `kmsKeyId`.',
            why: 'Without a KMS key, the storage volume of the notebook instance is not encrypted with a key that you control.',
            fix: 'Set `kmsKeyId` to a KMS key.',
            example:
                'The construction `new sagemaker.CfnNotebookInstance(this, "Notebook", { instanceType, roleArn })` reports `omitted`. Add `kmsKeyId: key.keyId`.',
        },
        schema: [],
        messages: {
            omitted: 'Leaving out {{property}} stores this SageMaker notebook unencrypted. Set {{property}}.',
        },
    },
    create(context) {
        const source = context.sourceCode;
        return {
            NewExpression(node) {
                const issues = listCdkTableIssues(source, node, SAGEMAKER_NOTEBOOK_CHECKS);
                for (const { node: target, property } of issues)
                    context.report({ node: target, messageId: 'omitted', data: { property } });
            },
        };
    },
});
