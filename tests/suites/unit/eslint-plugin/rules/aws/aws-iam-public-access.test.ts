import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsIamPublicAccess } from '#eslint-plugin/rules/aws/aws-iam-public-access.ts';

buildRuleTester().run('aws-iam-public-access', awsIamPublicAccess, {
    valid: [
        "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ principals: [new iam.AccountPrincipal('123456789012')] });",
        "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ principals: [role] });",
    ],
    invalid: [
        {
            code: "import * as iam from 'aws-cdk-lib/aws-iam';\nnew iam.PolicyStatement({ principals: [new iam.AnyPrincipal()] });\nnew iam.PolicyStatement({ principals: [new iam.ArnPrincipal('*')] });\nnew iam.PolicyStatement({ principals: [new iam.AccountPrincipal('1')] });\niam.PolicyStatement.fromJson({ Principal: '*' });\niam.PolicyStatement.fromJson({ Principal: { AWS: ['*'] } });\nnew iam.PolicyStatement({ effect: iam.Effect.DENY, principals: [new iam.StarPrincipal()] });",
            errors: [
                { messageId: 'publicPrincipal', line: 2 },
                { messageId: 'publicPrincipal', line: 3 },
                { messageId: 'publicPrincipal', line: 5 },
                { messageId: 'publicPrincipal', line: 6 },
            ],
        },
    ],
});
