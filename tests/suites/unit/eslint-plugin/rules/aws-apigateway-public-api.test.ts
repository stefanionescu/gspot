import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-apigateway-public-api', plugin.rules['aws-apigateway-public-api'], {
    valid: [
        "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nconst api = new apigateway.RestApi(this, 'Api', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.IAM } });\napi.root.addMethod('GET', integration);",
        "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nconst api = new apigateway.RestApi(this, 'Api');\napi.root.addMethod('GET', integration, buildOptions());",
    ],
    invalid: [
        {
            code: "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nimport * as v2 from 'aws-cdk-lib/aws-apigatewayv2';\nconst api = new apigateway.RestApi(this, 'api');\napi.root.addMethod('GET', integration);\napi.root.addMethod('POST', integration, { authorizationType: apigateway.AuthorizationType.NONE });\napi.root.addMethod('PUT', integration, { authorizationType: apigateway.AuthorizationType.IAM });\nconst secured = new apigateway.RestApi(this, 's', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.IAM } });\nsecured.root.addResource('users').addMethod('GET');\nconst open = new apigateway.RestApi(this, 'o', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.NONE } });\nopen.root.addMethod('GET');\nnew apigateway.CfnMethod(this, 'm', { httpMethod: 'GET' });\nnew v2.CfnRoute(this, 'r', { authorizationType: 'NONE' });",
            errors: [
                { messageId: 'omitted', line: 4 },
                { messageId: 'invalid', line: 5 },
                { messageId: 'invalid', line: 10 },
                { messageId: 'omitted', line: 11 },
                { messageId: 'invalid', line: 12 },
            ],
        },
    ],
});
