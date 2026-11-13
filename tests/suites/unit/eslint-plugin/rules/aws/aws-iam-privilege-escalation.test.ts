import { awsIamPrivilegeEscalation } from '#eslint-plugin/rules/aws/aws-iam-privilege-escalation.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-iam-privilege-escalation', awsIamPrivilegeEscalation, {
    valid: [
        "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ actions: ['iam:PassRole'], resources: [role.roleArn] });",
    ],
    invalid: [
        {
            code: "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ actions: ['iam:PassRole'], resources: ['*'] });\nnew iam.PolicyStatement({ actions: ['iam:PassRole'], resources: ['arn:aws:iam::1:role/*'] });\nnew iam.PolicyStatement({ actions: ['iam:PassRole'], resources: ['*'], conditions: {} });\nnew iam.PolicyStatement({ actions: ['s3:GetObject'], resources: ['*'] });\niam.PolicyStatement.fromJson({ Action: 'sts:AssumeRole', Resource: '*' });",
            errors: [
                { messageId: 'escalation', data: { action: 'iam:PassRole' }, line: 2 },
                { messageId: 'escalation', data: { action: 'iam:PassRole' }, line: 3 },
                { messageId: 'escalation', data: { action: 'sts:AssumeRole' }, line: 6 },
            ],
        },
    ],
});
