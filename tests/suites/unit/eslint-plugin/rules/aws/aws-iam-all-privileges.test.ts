import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsIamAllPrivileges } from '#eslint-plugin/rules/aws/aws-iam-all-privileges.ts';

buildRuleTester().run('aws-iam-all-privileges', awsIamAllPrivileges, {
    valid: [
        "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ actions: ['s3:GetObject'], resources: ['*'] });",
    ],
    invalid: [
        {
            code: "import { PolicyStatement, Effect, PolicyDocument } from 'aws-cdk-lib/aws-iam';\nnew PolicyStatement({ actions: ['*'], resources: ['arn'] });\nnew PolicyStatement({ effect: Effect.DENY, actions: ['*'] });\nnew PolicyStatement({ effect: Effect.ALLOW, actions: ['s3:*', '*'] });\nPolicyStatement.fromJson({ Effect: 'Allow', Action: '*' });\nPolicyDocument.fromJson({ Statement: [{ Effect: 'Allow', Action: ['*'] }, { Effect: 'Deny', Action: '*' }] });",
            errors: [
                { messageId: 'allActions', line: 2 },
                { messageId: 'allActions', line: 4 },
                { messageId: 'allActions', line: 5 },
                { messageId: 'allActions', line: 6 },
            ],
        },
    ],
});
