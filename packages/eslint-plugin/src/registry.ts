import { weakSsl } from './rules/networks/weak-ssl.ts';
import { noVueMixins } from './rules/vue/no-vue-mixins.ts';
import { noCodeEval } from './rules/security/no-code-eval.ts';
import { noWeakKeys } from './rules/security/no-weak-keys.ts';
import { noWeakCipher } from './rules/security/no-weak-cipher.ts';
import { xmlParserXxe } from './rules/security/xml-parser-xxe.ts';
import { requireNoopener } from './rules/web/require-noopener.ts';
import { noTestRetries } from './rules/testing/no-test-retries.ts';
import { noHardcodedIp } from './rules/networks/no-hardcoded-ip.ts';
import { noWeakHashing } from './rules/security/no-weak-hashing.ts';
import { noGeneratedKeys } from './rules/react/no-generated-keys.ts';
import { maxRequestSize } from './rules/servers/max-request-size.ts';
import { testHooksFirst } from './rules/testing/test-hooks-first.ts';
import { awsEfsUnencrypted } from './rules/aws/aws-efs-unencrypted.ts';
import { preferTestTable } from './rules/testing/prefer-test-table.ts';
import { awsOpenAdminPorts } from './rules/aws/aws-open-admin-ports.ts';
import { noCodeAfterDone } from './rules/testing/no-code-after-done.ts';
import { noEmptyTestFile } from './rules/testing/no-empty-test-file.ts';
import { awsPublicInstances } from './rules/aws/aws-public-instances.ts';
import { dynamicTemplates } from './rules/security/dynamic-templates.ts';
import { noExclusiveTests } from './rules/testing/no-exclusive-tests.ts';
import { awsIamPublicAccess } from './rules/aws/aws-iam-public-access.ts';
import { noLeakedJsxNumber } from './rules/react/no-leaked-jsx-number.ts';
import { noSelfStateUpdate } from './rules/react/no-self-state-update.ts';
import { insecureJwtToken } from './rules/security/insecure-jwt-token.ts';
import { noEmptyTestTable } from './rules/testing/no-empty-test-table.ts';
import { noFixedTestWaits } from './rules/testing/no-fixed-test-waits.ts';
import { noVueUpdatedWrites } from './rules/vue/no-vue-updated-writes.ts';
import { noProductionDebug } from './rules/servers/no-production-debug.ts';
import { awsIamAllPrivileges } from './rules/aws/aws-iam-all-privileges.ts';
import { noAnyOriginPolicy } from './rules/servers/no-any-origin-policy.ts';
import { noEarlyTestReturn } from './rules/testing/no-early-test-return.ts';
import { noEmptyTestTitles } from './rules/testing/no-empty-test-titles.ts';
import { noForcedUiActions } from './rules/testing/no-forced-ui-actions.ts';
import { noUiTestDebugging } from './rules/testing/no-ui-test-debugging.ts';
import { noAnyOriginMessages } from './rules/web/no-any-origin-messages.ts';
import { preferNativeAxios } from './rules/libraries/prefer-native-axios.ts';
import { requireMemoizeKey } from './rules/libraries/require-memoize-key.ts';
import { unverifiedHostname } from './rules/networks/unverified-hostname.ts';
import { noComponentDebounce } from './rules/react/no-component-debounce.ts';
import { preferReadonlyProps } from './rules/react/prefer-readonly-props.ts';
import { noSetterInComponent } from './rules/react/no-setter-in-component.ts';
import { noNestedVitestMock } from './rules/testing/no-nested-vitest-mock.ts';
import { noVueClassComponents } from './rules/vue/no-vue-class-components.ts';
import { awsUnencryptedVolumes } from './rules/aws/aws-unencrypted-volumes.ts';
import { preferNativeJquery } from './rules/libraries/prefer-native-jquery.ts';
import { preferNativeLodash } from './rules/libraries/prefer-native-lodash.ts';
import { staticBeforeSession } from './rules/servers/static-before-session.ts';
import { dompurifyUnsafeConfig } from './rules/web/dompurify-unsafe-config.ts';
import { requireErrorChecks } from './rules/assertions/require-error-checks.ts';
import { awsPublicBucketGrants } from './rules/aws/aws-public-bucket-grants.ts';
import { awsS3BucketVersioning } from './rules/aws/aws-s3-bucket-versioning.ts';
import { noUnsafeFileUploads } from './rules/servers/no-unsafe-file-uploads.ts';
import { noDuplicateTestRows } from './rules/testing/no-duplicate-test-rows.ts';
import { noDynamicSqlQueries } from './rules/security/no-dynamic-sql-queries.ts';
import { awsApigatewayPublicApi } from './rules/aws/aws-apigateway-public-api.ts';
import { awsSqsUnencryptedQueue } from './rules/aws/aws-sqs-unencrypted-queue.ts';
import { disabledAutoEscaping } from './rules/security/disabled-auto-escaping.ts';
import { encryptionSecureMode } from './rules/security/encryption-secure-mode.ts';
import { awsUnencryptedNotebooks } from './rules/aws/aws-unencrypted-notebooks.ts';
import { noClearTextProtocols } from './rules/networks/no-clear-text-protocols.ts';
import { unverifiedCertificate } from './rules/networks/unverified-certificate.ts';
import { requireCsrfMiddleware } from './rules/servers/require-csrf-middleware.ts';
import { noInlineInterpolation } from './rules/testing/no-inline-interpolation.ts';
import { testingLibraryQueries } from './rules/testing/testing-library-queries.ts';
import { noConstantAssertions } from './rules/assertions/no-constant-assertions.ts';
import { noInvertedAssertions } from './rules/assertions/no-inverted-assertions.ts';
import { validThrowAssertions } from './rules/assertions/valid-throw-assertions.ts';
import { awsSnsUnencryptedTopics } from './rules/aws/aws-sns-unencrypted-topics.ts';
import { noAsyncSuiteCallbacks } from './rules/testing/no-async-suite-callbacks.ts';
import { noDuplicateTestTitles } from './rules/testing/no-duplicate-test-titles.ts';
import { noMisplacedAssertions } from './rules/assertions/no-misplaced-assertions.ts';
import { requireTestAssertions } from './rules/assertions/require-test-assertions.ts';
import { noUnexplainedTestSkips } from './rules/testing/no-unexplained-test-skips.ts';
import { disabledResourceIntegrity } from './rules/web/disabled-resource-integrity.ts';
import { noIncompleteAssertions } from './rules/assertions/no-incomplete-assertions.ts';
import { awsIamPrivilegeEscalation } from './rules/aws/aws-iam-privilege-escalation.ts';
import { awsUnblockedPublicBuckets } from './rules/aws/aws-unblocked-public-buckets.ts';
import { awsOpensearchserviceDomain } from './rules/aws/aws-opensearchservice-domain.ts';
import { noPublicFilePermissions } from './rules/security/no-public-file-permissions.ts';
import { preferMatcherAssertions } from './rules/assertions/prefer-matcher-assertions.ts';
import { awsInsecureBucketTransport } from './rules/aws/aws-insecure-bucket-transport.ts';
import { awsRdsUnencryptedDatabases } from './rules/aws/aws-rds-unencrypted-databases.ts';
import { noDefaultUtilityImports } from './rules/libraries/no-default-utility-imports.ts';
import { reviewBlockchainMnemonic } from './rules/security/review-blockchain-mnemonic.ts';
import { noOverflowingTestTimeout } from './rules/testing/no-overflowing-test-timeout.ts';
import { noCypressThenAssertions } from './rules/assertions/no-cypress-then-assertions.ts';
import { hardcodedSecretSignatures } from './rules/security/hardcoded-secret-signatures.ts';
import { requireSessionRegeneration } from './rules/servers/require-session-regeneration.ts';
import { noSelfComparingAssertions } from './rules/assertions/no-self-comparing-assertions.ts';
import { noUncertainChaiAssertions } from './rules/assertions/no-uncertain-chai-assertions.ts';
import { noMismatchedAssertionTypes } from './rules/assertions/no-mismatched-assertion-types.ts';

export const testRules = {
    'no-exclusive-tests': noExclusiveTests,
    'no-unexplained-test-skips': noUnexplainedTestSkips,
    'no-early-test-return': noEarlyTestReturn,
    'no-empty-test-titles': noEmptyTestTitles,
    'no-duplicate-test-titles': noDuplicateTestTitles,
    'test-hooks-first': testHooksFirst,
    'no-async-suite-callbacks': noAsyncSuiteCallbacks,
    'no-code-after-done': noCodeAfterDone,
    'no-overflowing-test-timeout': noOverflowingTestTimeout,
    'no-test-retries': noTestRetries,
    'no-inline-interpolation': noInlineInterpolation,
    'no-nested-vitest-mock': noNestedVitestMock,
    'no-empty-test-table': noEmptyTestTable,
    'no-duplicate-test-rows': noDuplicateTestRows,
    'prefer-test-table': preferTestTable,
    'no-empty-test-file': noEmptyTestFile,
    'no-incomplete-assertions': noIncompleteAssertions,
    'no-inverted-assertions': noInvertedAssertions,
    'no-self-comparing-assertions': noSelfComparingAssertions,
    'require-error-checks': requireErrorChecks,
    'no-uncertain-chai-assertions': noUncertainChaiAssertions,
    'no-ui-test-debugging': noUiTestDebugging,
    'no-forced-ui-actions': noForcedUiActions,
    'testing-library-queries': testingLibraryQueries,
    'no-fixed-test-waits': noFixedTestWaits,
    'no-constant-assertions': noConstantAssertions,
    'prefer-matcher-assertions': preferMatcherAssertions,
    'no-mismatched-assertion-types': noMismatchedAssertionTypes,
    'valid-throw-assertions': validThrowAssertions,
    'require-test-assertions': requireTestAssertions,
    'no-misplaced-assertions': noMisplacedAssertions,
    'no-cypress-then-assertions': noCypressThenAssertions,
};

export const frameworkRules = {
    'no-setter-in-component': noSetterInComponent,
    'no-self-state-update': noSelfStateUpdate,
    'no-generated-keys': noGeneratedKeys,
    'no-leaked-jsx-number': noLeakedJsxNumber,
    'no-vue-class-components': noVueClassComponents,
    'no-vue-mixins': noVueMixins,
    'no-default-utility-imports': noDefaultUtilityImports,
    'require-memoize-key': requireMemoizeKey,
    'prefer-native-jquery': preferNativeJquery,
    'prefer-native-axios': preferNativeAxios,
    'no-component-debounce': noComponentDebounce,
    'prefer-readonly-props': preferReadonlyProps,
    'no-vue-updated-writes': noVueUpdatedWrites,
    'prefer-native-lodash': preferNativeLodash,
};

/**
The rules that flag weak cryptography, turned-off TLS checks, queries and templates built from strings, unsafe Express
settings, and secrets in the code.
*/
export const securityRules = {
    'xml-parser-xxe': xmlParserXxe,
    'weak-ssl': weakSsl,
    'no-weak-keys': noWeakKeys,
    'require-csrf-middleware': requireCsrfMiddleware,
    'unverified-certificate': unverifiedCertificate,
    'no-any-origin-policy': noAnyOriginPolicy,
    'unverified-hostname': unverifiedHostname,
    'encryption-secure-mode': encryptionSecureMode,
    'no-weak-cipher': noWeakCipher,
    'insecure-jwt-token': insecureJwtToken,
    'hardcoded-secret-signatures': hardcodedSecretSignatures,
    'static-before-session': staticBeforeSession,
    'no-weak-hashing': noWeakHashing,
    'no-dynamic-sql-queries': noDynamicSqlQueries,
    'no-unsafe-file-uploads': noUnsafeFileUploads,
    'no-public-file-permissions': noPublicFilePermissions,
    'no-production-debug': noProductionDebug,
    'max-request-size': maxRequestSize,
    'disabled-resource-integrity': disabledResourceIntegrity,
    'require-session-regeneration': requireSessionRegeneration,
    'no-hardcoded-ip': noHardcodedIp,
    'no-code-eval': noCodeEval,
    'no-any-origin-messages': noAnyOriginMessages,
    'require-noopener': requireNoopener,
    'disabled-auto-escaping': disabledAutoEscaping,
    'no-clear-text-protocols': noClearTextProtocols,
    'dynamic-templates': dynamicTemplates,
    'dompurify-unsafe-config': dompurifyUnsafeConfig,
    'review-blockchain-mnemonic': reviewBlockchainMnemonic,
};

/**
The rules that flag unsafe cloud infrastructure code: open storage and networks, missing encryption, and broad access
policies.
*/
export const awsRules = {
    'aws-insecure-bucket-transport': awsInsecureBucketTransport,
    'aws-s3-bucket-versioning': awsS3BucketVersioning,
    'aws-public-bucket-grants': awsPublicBucketGrants,
    'aws-iam-public-access': awsIamPublicAccess,
    'aws-unencrypted-volumes': awsUnencryptedVolumes,
    'aws-unblocked-public-buckets': awsUnblockedPublicBuckets,
    'aws-iam-all-privileges': awsIamAllPrivileges,
    'aws-rds-unencrypted-databases': awsRdsUnencryptedDatabases,
    'aws-opensearchservice-domain': awsOpensearchserviceDomain,
    'aws-iam-privilege-escalation': awsIamPrivilegeEscalation,
    'aws-unencrypted-notebooks': awsUnencryptedNotebooks,
    'aws-open-admin-ports': awsOpenAdminPorts,
    'aws-sns-unencrypted-topics': awsSnsUnencryptedTopics,
    'aws-public-instances': awsPublicInstances,
    'aws-sqs-unencrypted-queue': awsSqsUnencryptedQueue,
    'aws-efs-unencrypted': awsEfsUnencrypted,
    'aws-apigateway-public-api': awsApigatewayPublicApi,
};
