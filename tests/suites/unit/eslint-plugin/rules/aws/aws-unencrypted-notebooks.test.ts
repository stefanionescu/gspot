import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsUnencryptedNotebooks } from '#eslint-plugin/rules/aws/aws-unencrypted-notebooks.ts';

buildRuleTester().run('aws-unencrypted-notebooks', awsUnencryptedNotebooks, {
    valid: [
        "import * as sagemaker from 'aws-cdk-lib/aws-sagemaker';\nnew sagemaker.CfnNotebookInstance(this, 'Notebook', { kmsKeyId: key.keyId });",
    ],
    invalid: [
        {
            code: "import { aws_sagemaker as sagemaker } from 'aws-cdk-lib';\nnew sagemaker.CfnNotebookInstance(this, 'a', { instanceType });\nnew sagemaker.CfnNotebookInstance(this, 'b', { kmsKeyId: key });",
            errors: [{ messageId: 'omitted', line: 2 }],
        },
    ],
});
