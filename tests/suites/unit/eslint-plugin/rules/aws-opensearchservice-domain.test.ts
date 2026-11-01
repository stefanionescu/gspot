import plugin from '#eslint-plugin/plugin.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-opensearchservice-domain', plugin.rules['aws-opensearchservice-domain'], {
    valid: [
        "import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';\nnew opensearch.Domain(this, 'Search', { encryptionAtRest: { enabled: true } });",
    ],
    invalid: [
        {
            code: "import * as os from 'aws-cdk-lib/aws-opensearchservice';\nimport * as es from 'aws-cdk-lib/aws-elasticsearch';\nnew os.Domain(this, 'a', { version: os.EngineVersion.OPENSEARCH_1_0 });\nnew os.Domain(this, 'b', { encryptionAtRest: { enabled: false } });\nnew os.CfnDomain(this, 'c', { encryptionAtRestOptions: { enabled: true } });\nnew es.Domain(this, 'd', { version: es.ElasticsearchVersion.V7_10, encryptionAtRest: {} });\nnew es.CfnDomain(this, 'e');",
            errors: [
                { messageId: 'omitted', line: 3 },
                { messageId: 'unencrypted', line: 4 },
                { messageId: 'omitted', line: 6 },
                { messageId: 'omitted', line: 7 },
            ],
        },
    ],
});
