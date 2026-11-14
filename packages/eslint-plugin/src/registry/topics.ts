import { LANGUAGE_TOPICS } from './language.ts';
import { weakSsl } from '../rules/networks/weak-ssl.ts';
import { noVueMixins } from '../rules/vue/no-vue-mixins.ts';
import { noCodeEval } from '../rules/security/no-code-eval.ts';
import { noWeakKeys } from '../rules/cryptography/no-weak-keys.ts';
import { xmlParserXxe } from '../rules/security/xml-parser-xxe.ts';
import { requireNoopener } from '../rules/web/require-noopener.ts';
import { noTestRetries } from '../rules/testing/no-test-retries.ts';
import { tableHeader } from '../rules/accessibility/table-header.ts';
import { noHardcodedIp } from '../rules/networks/no-hardcoded-ip.ts';
import { noPathCommand } from '../rules/security/no-path-command.ts';
import { noGeneratedKeys } from '../rules/react/no-generated-keys.ts';
import { maxRequestSize } from '../rules/servers/max-request-size.ts';
import { testHooksFirst } from '../rules/testing/test-hooks-first.ts';
import { noWeakCipher } from '../rules/cryptography/no-weak-cipher.ts';
import { awsEfsUnencrypted } from '../rules/aws/aws-efs-unencrypted.ts';
import { preferTestTable } from '../rules/testing/prefer-test-table.ts';
import { requireServerOnly } from '../rules/web/require-server-only.ts';
import { awsOpenAdminPorts } from '../rules/aws/aws-open-admin-ports.ts';
import { noWeakHashing } from '../rules/cryptography/no-weak-hashing.ts';
import { noCodeAfterDone } from '../rules/testing/no-code-after-done.ts';
import { noEmptyTestFile } from '../rules/testing/no-empty-test-file.ts';
import { awsPublicInstances } from '../rules/aws/aws-public-instances.ts';
import { dynamicTemplates } from '../rules/security/dynamic-templates.ts';
import { noExclusiveTests } from '../rules/testing/no-exclusive-tests.ts';
import { awsIamPublicAccess } from '../rules/aws/aws-iam-public-access.ts';
import { noLeakedJsxNumber } from '../rules/react/no-leaked-jsx-number.ts';
import { noSelfStateUpdate } from '../rules/react/no-self-state-update.ts';
import { noEmptyTestTable } from '../rules/testing/no-empty-test-table.ts';
import { noFixedTestWaits } from '../rules/testing/no-fixed-test-waits.ts';
import { noVueUpdatedWrites } from '../rules/vue/no-vue-updated-writes.ts';
import { noInsecureCookies } from '../rules/servers/no-insecure-cookies.ts';
import { noProductionDebug } from '../rules/servers/no-production-debug.ts';
import { noClientEnvironment } from '../rules/web/no-client-environment.ts';
import { awsIamAllPrivileges } from '../rules/aws/aws-iam-all-privileges.ts';
import { noAnyOriginPolicy } from '../rules/servers/no-any-origin-policy.ts';
import { noPoweredByHeader } from '../rules/servers/no-powered-by-header.ts';
import { noEarlyTestReturn } from '../rules/testing/no-early-test-return.ts';
import { noEmptyTestTitles } from '../rules/testing/no-empty-test-titles.ts';
import { noForcedUiActions } from '../rules/testing/no-forced-ui-actions.ts';
import { noUiTestDebugging } from '../rules/testing/no-ui-test-debugging.ts';
import { noAnyOriginMessages } from '../rules/web/no-any-origin-messages.ts';
import { unverifiedHostname } from '../rules/networks/unverified-hostname.ts';
import { noComponentDebounce } from '../rules/react/no-component-debounce.ts';
import { preferReadonlyProps } from '../rules/react/prefer-readonly-props.ts';
import { preferNativeAxios } from '../rules/utilities/prefer-native-axios.ts';
import { requireMemoizeKey } from '../rules/utilities/require-memoize-key.ts';
import { noTableAsLayout } from '../rules/accessibility/no-table-as-layout.ts';
import { insecureJwtToken } from '../rules/cryptography/insecure-jwt-token.ts';
import { noInsecureRandom } from '../rules/cryptography/no-insecure-random.ts';
import { noSetterInComponent } from '../rules/react/no-setter-in-component.ts';
import { noNestedVitestMock } from '../rules/testing/no-nested-vitest-mock.ts';
import { noVueClassComponents } from '../rules/vue/no-vue-class-components.ts';
import { awsUnencryptedVolumes } from '../rules/aws/aws-unencrypted-volumes.ts';
import { staticBeforeSession } from '../rules/servers/static-before-session.ts';
import { preferNativeJquery } from '../rules/utilities/prefer-native-jquery.ts';
import { preferNativeLodash } from '../rules/utilities/prefer-native-lodash.ts';
import { dompurifyUnsafeConfig } from '../rules/web/dompurify-unsafe-config.ts';
import { requireErrorChecks } from '../rules/assertions/require-error-checks.ts';
import { awsPublicBucketGrants } from '../rules/aws/aws-public-bucket-grants.ts';
import { awsS3BucketVersioning } from '../rules/aws/aws-s3-bucket-versioning.ts';
import { noUnsafeFileUploads } from '../rules/servers/no-unsafe-file-uploads.ts';
import { noDuplicateTestRows } from '../rules/testing/no-duplicate-test-rows.ts';
import { noDynamicSqlQueries } from '../rules/security/no-dynamic-sql-queries.ts';
import { awsApigatewayPublicApi } from '../rules/aws/aws-apigateway-public-api.ts';
import { awsSqsUnencryptedQueue } from '../rules/aws/aws-sqs-unencrypted-queue.ts';
import { disabledAutoEscaping } from '../rules/security/disabled-auto-escaping.ts';
import { awsUnencryptedNotebooks } from '../rules/aws/aws-unencrypted-notebooks.ts';
import { noClearTextProtocols } from '../rules/networks/no-clear-text-protocols.ts';
import { unverifiedCertificate } from '../rules/networks/unverified-certificate.ts';
import { requireCsrfMiddleware } from '../rules/servers/require-csrf-middleware.ts';
import { testingLibraryQueries } from '../rules/testing/testing-library-queries.ts';
import { noConstantAssertions } from '../rules/assertions/no-constant-assertions.ts';
import { noInvertedAssertions } from '../rules/assertions/no-inverted-assertions.ts';
import { validThrowAssertions } from '../rules/assertions/valid-throw-assertions.ts';
import { awsSnsUnencryptedTopics } from '../rules/aws/aws-sns-unencrypted-topics.ts';
import { noUnvalidatedJsonBody } from '../rules/servers/no-unvalidated-json-body.ts';
import { noAsyncSuiteCallbacks } from '../rules/testing/no-async-suite-callbacks.ts';
import { noDuplicateTestTitles } from '../rules/testing/no-duplicate-test-titles.ts';
import { noUnsafeSanitizerBypass } from '../rules/web/no-unsafe-sanitizer-bypass.ts';
import { noPublicTemporaryPath } from '../rules/security/no-public-temporary-path.ts';
import { noMisplacedAssertions } from '../rules/assertions/no-misplaced-assertions.ts';
import { requireTestAssertions } from '../rules/assertions/require-test-assertions.ts';
import { encryptionSecureMode } from '../rules/cryptography/encryption-secure-mode.ts';
import { noUncheckedRequestData } from '../rules/servers/no-unchecked-request-data.ts';
import { noUnexplainedTestSkips } from '../rules/testing/no-unexplained-test-skips.ts';
import { embedAlternativeText } from '../rules/accessibility/embed-alternative-text.ts';
import { tableHeaderReference } from '../rules/accessibility/table-header-reference.ts';
import { disabledResourceIntegrity } from '../rules/web/disabled-resource-integrity.ts';
import { noIncompleteAssertions } from '../rules/assertions/no-incomplete-assertions.ts';
import { awsIamPrivilegeEscalation } from '../rules/aws/aws-iam-privilege-escalation.ts';
import { awsUnblockedPublicBuckets } from '../rules/aws/aws-unblocked-public-buckets.ts';
import { noUnsafeSecurityHeaders } from '../rules/servers/no-unsafe-security-headers.ts';
import { noShallowCloneMutation } from '../rules/utilities/no-shallow-clone-mutation.ts';
import { awsOpensearchserviceDomain } from '../rules/aws/aws-opensearchservice-domain.ts';
import { noPublicFilePermissions } from '../rules/security/no-public-file-permissions.ts';
import { preferMatcherAssertions } from '../rules/assertions/prefer-matcher-assertions.ts';
import { awsInsecureBucketTransport } from '../rules/aws/aws-insecure-bucket-transport.ts';
import { awsRdsUnencryptedDatabases } from '../rules/aws/aws-rds-unencrypted-databases.ts';
import { noOverflowingTestTimeout } from '../rules/testing/no-overflowing-test-timeout.ts';
import { noDefaultUtilityImports } from '../rules/utilities/no-default-utility-imports.ts';
import { noCypressThenAssertions } from '../rules/assertions/no-cypress-then-assertions.ts';
import { requireSessionRegeneration } from '../rules/servers/require-session-regeneration.ts';
import { reviewBlockchainMnemonic } from '../rules/cryptography/review-blockchain-mnemonic.ts';
import { noSelfComparingAssertions } from '../rules/assertions/no-self-comparing-assertions.ts';
import { noUncertainChaiAssertions } from '../rules/assertions/no-uncertain-chai-assertions.ts';
import { hardcodedSecretSignatures } from '../rules/cryptography/hardcoded-secret-signatures.ts';
import { noMismatchedAssertionTypes } from '../rules/assertions/no-mismatched-assertion-types.ts';

/**
Every rule topic. Each key names the folder of `rules/` that holds its rules. The language topics sit in
`language.ts`, because one file with every import passes the file length limit.
*/
export const TOPICS = {
    ...LANGUAGE_TOPICS,
    accessibility: [embedAlternativeText, noTableAsLayout, tableHeaderReference, tableHeader],
    assertions: [
        noConstantAssertions,
        noCypressThenAssertions,
        noIncompleteAssertions,
        noInvertedAssertions,
        noMismatchedAssertionTypes,
        noMisplacedAssertions,
        noSelfComparingAssertions,
        noUncertainChaiAssertions,
        preferMatcherAssertions,
        requireErrorChecks,
        requireTestAssertions,
        validThrowAssertions,
    ],
    aws: [
        awsApigatewayPublicApi,
        awsEfsUnencrypted,
        awsIamAllPrivileges,
        awsIamPrivilegeEscalation,
        awsIamPublicAccess,
        awsInsecureBucketTransport,
        awsOpenAdminPorts,
        awsOpensearchserviceDomain,
        awsPublicBucketGrants,
        awsPublicInstances,
        awsRdsUnencryptedDatabases,
        awsS3BucketVersioning,
        awsSnsUnencryptedTopics,
        awsSqsUnencryptedQueue,
        awsUnblockedPublicBuckets,
        awsUnencryptedNotebooks,
        awsUnencryptedVolumes,
    ],
    cryptography: [
        encryptionSecureMode,
        hardcodedSecretSignatures,
        insecureJwtToken,
        noInsecureRandom,
        noWeakCipher,
        noWeakHashing,
        noWeakKeys,
        reviewBlockchainMnemonic,
    ],
    networks: [noClearTextProtocols, noHardcodedIp, unverifiedCertificate, unverifiedHostname, weakSsl],
    react: [
        noComponentDebounce,
        noGeneratedKeys,
        noLeakedJsxNumber,
        noSelfStateUpdate,
        noSetterInComponent,
        preferReadonlyProps,
    ],
    security: [
        disabledAutoEscaping,
        dynamicTemplates,
        noCodeEval,
        noDynamicSqlQueries,
        noPathCommand,
        noPublicFilePermissions,
        noPublicTemporaryPath,
        xmlParserXxe,
    ],
    servers: [
        maxRequestSize,
        noAnyOriginPolicy,
        noInsecureCookies,
        noPoweredByHeader,
        noProductionDebug,
        noUncheckedRequestData,
        noUnsafeFileUploads,
        noUnsafeSecurityHeaders,
        noUnvalidatedJsonBody,
        requireCsrfMiddleware,
        requireSessionRegeneration,
        staticBeforeSession,
    ],
    testing: [
        noAsyncSuiteCallbacks,
        noCodeAfterDone,
        noDuplicateTestRows,
        noDuplicateTestTitles,
        noEarlyTestReturn,
        noEmptyTestFile,
        noEmptyTestTable,
        noEmptyTestTitles,
        noExclusiveTests,
        noFixedTestWaits,
        noForcedUiActions,
        noNestedVitestMock,
        noOverflowingTestTimeout,
        noTestRetries,
        noUiTestDebugging,
        noUnexplainedTestSkips,
        preferTestTable,
        testHooksFirst,
        testingLibraryQueries,
    ],
    utilities: [
        noDefaultUtilityImports,
        noShallowCloneMutation,
        preferNativeAxios,
        preferNativeJquery,
        preferNativeLodash,
        requireMemoizeKey,
    ],
    vue: [noVueClassComponents, noVueMixins, noVueUpdatedWrites],
    web: [
        disabledResourceIntegrity,
        dompurifyUnsafeConfig,
        noAnyOriginMessages,
        noClientEnvironment,
        noUnsafeSanitizerBypass,
        requireNoopener,
        requireServerOnly,
    ],
};
