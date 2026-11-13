import { weakSsl } from '#eslint-plugin/rules/networks/weak-ssl.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('weak-ssl', weakSsl, {
    valid: [
        "import tls from 'tls';\ntls.connect({ host: 'example.com', minVersion: 'TLSv1.2' });",
        "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nnew apigateway.CfnDomainName(this, 'Domain', { securityPolicy: 'TLS_1_2' });",
        "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nnew apigateway.DomainName(this, 'Domain', { securityPolicy: undefined });",
    ],
    invalid: [
        {
            code: "import tls from 'tls';\nconst version = 'TLSv1';\nconst options = { minVersion: version };\nfunction connect(version) {\n    tls.connect(options);\n}",
            errors: [{ messageId: 'oldVersion', data: { option: 'minVersion' }, line: 3 }],
        },
        {
            code: "const https = require('https');\nconst tls = require('tls');\nconst constants = require('constants');\nhttps.request({ minVersion: 'TLSv1.1', maxVersion: 'TLSv1' });\ntls.connect({ secureProtocol: 'TLSv1_method' });\ntls.connect({ secureProtocol: 'TLS_method' });\ntls.createSecureContext({ secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3 });\ntls.createSecureContext({ secureOptions: constants.SSL_OP_NO_SSLv2 | constants.SSL_OP_NO_SSLv3 | constants.SSL_OP_NO_TLSv1 | constants.SSL_OP_NO_TLSv1_1 });\ntls.createSecureContext({ secureOptions: compute() });",
            errors: [
                { messageId: 'oldVersion', data: { option: 'minVersion' }, line: 4 },
                { messageId: 'oldVersion', data: { option: 'maxVersion' }, line: 4 },
                { messageId: 'oldVersion', data: { option: 'secureProtocol' }, line: 5 },
                { messageId: 'oldProtocols', data: { option: 'secureOptions' }, line: 7 },
            ],
        },
        {
            code: "import * as apigateway from 'aws-cdk-lib/aws-apigateway';\nimport * as os from 'aws-cdk-lib/aws-opensearchservice';\nnew apigateway.CfnDomainName(this, 'a', {});\nnew apigateway.DomainName(this, 'c', { securityPolicy: apigateway.SecurityPolicy.TLS_1_0 });\nnew apigateway.DomainName(this, 'd', {});\nnew os.Domain(this, 'f', { tlsSecurityPolicy: os.TLSSecurityPolicy.TLS_1_2 });\nnew os.CfnDomain(this, 'g', { domainEndpointOptions: { tlsSecurityPolicy: 'Policy-Min-TLS-1-0-2019-07' } });",
            errors: [
                { messageId: 'omittedPolicy', data: { option: 'securityPolicy' }, line: 3 },
                { messageId: 'oldPolicy', data: { option: 'securityPolicy' }, line: 4 },
                {
                    messageId: 'oldPolicy',
                    data: { option: 'domainEndpointOptions.tlsSecurityPolicy' },
                    line: 7,
                },
            ],
        },
    ],
});
