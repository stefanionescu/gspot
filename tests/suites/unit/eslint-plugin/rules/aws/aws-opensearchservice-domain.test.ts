import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';
import { awsOpensearchserviceDomain } from '#eslint-plugin/rules/aws/aws-opensearchservice-domain.ts';

buildRuleTester().run('aws-opensearchservice-domain', awsOpensearchserviceDomain, {
    valid: [
        "import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';\nnew opensearch.Domain(this, 'Search', { encryptionAtRest: { enabled: true } });",
        "import * as os from 'aws-cdk-lib/aws-opensearchservice';\nnew os.Domain(...args);",
    ],
    invalid: [
        {
            code: "import * as os from 'aws-cdk-lib/aws-opensearchservice';\nnew os.CfnDomain(this, 'a', { engineVersion: 'Elasticsearch_7.10' });",
            errors: [
                {
                    messageId: 'omitted',
                    data: { property: 'encryptionAtRestOptions', engine: 'Elasticsearch' },
                    line: 2,
                },
            ],
        },
        {
            code: "import * as os from 'aws-cdk-lib/aws-opensearchservice';\nnew os.Domain(this, 'b', { version: os.EngineVersion.ELASTICSEARCH_7_10 });",
            errors: [{ messageId: 'omitted', data: { property: 'encryptionAtRest', engine: 'Elasticsearch' } }],
        },
        {
            code: "import * as os from 'aws-cdk-lib/aws-opensearchservice';\nnew os.Domain(this, 'b', { encryptionAtRest: { enabled: false } });",
            errors: [{ messageId: 'unencrypted', data: { engine: 'OpenSearch' }, line: 2 }],
        },
    ],
});
