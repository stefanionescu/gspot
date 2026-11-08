import { awsOpensearchserviceDomain } from '#eslint-plugin/rules/aws/aws-opensearchservice-domain.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('aws-opensearchservice-domain', awsOpensearchserviceDomain, {
    valid: [
        "import * as opensearch from 'aws-cdk-lib/aws-opensearchservice';\nnew opensearch.Domain(this, 'Search', { encryptionAtRest: { enabled: true } });",
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
    ],
});
