import { awsApigatewayPublicApi } from '#eslint-plugin/rules/aws/aws-apigateway-public-api.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-apigateway-public-api', awsApigatewayPublicApi, {
    valid: [
        "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nconst api = new apigateway.RestApi(this, 'Api');\napi.root.addMethod('GET', integration, buildOptions());",
    ],
    invalid: [
        {
            code: "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nimport * as v2 from 'aws-cdk-lib/aws-apigatewayv2';\nconst api = new apigateway.RestApi(this, 'api');\napi.root.addMethod('GET', integration);\napi.root.addMethod('POST', integration, { authorizationType: apigateway.AuthorizationType.NONE });\napi.root.addMethod('PUT', integration, { authorizationType: apigateway.AuthorizationType.IAM });\nconst secured = new apigateway.RestApi(this, 's', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.IAM } });\nsecured.root.addResource('users').addMethod('GET');\nconst open = new apigateway.RestApi(this, 'o', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.NONE } });\nopen.root.addMethod('GET');\nnew apigateway.CfnMethod(this, 'm', { httpMethod: 'GET' });\nnew v2.CfnRoute(this, 'r', { authorizationType: 'NONE' });\nsecured.root.addResource('open', { defaultMethodOptions: { authorizationType: apigateway.AuthorizationType.NONE } }).addMethod('GET');",
            errors: [
                { messageId: 'omitted', line: 4 },
                { messageId: 'invalid', line: 5 },
                { messageId: 'invalid', line: 10 },
                { messageId: 'omitted', line: 11 },
                { messageId: 'invalid', line: 12 },
                { messageId: 'invalid', line: 13 },
            ],
        },
    ],
});
