import { awsUnencryptedNotebooks } from '#eslint-plugin/rules/aws/aws-unencrypted-notebooks.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-unencrypted-notebooks', awsUnencryptedNotebooks, {
    valid: [
        "import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';\nnew sagemaker.CfnNotebookInstance(this, 'Notebook', { kmsKeyId: key.keyId });",
    ],
    invalid: [
        {
            code: "import { aws_sagemaker as sagemaker } from 'aws-cdk-lib';\nnew sagemaker.CfnNotebookInstance(this, 'a', { instanceType });",
            errors: [{ messageId: 'omitted', line: 2 }],
        },
    ],
});
