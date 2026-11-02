import { weakSsl } from '../rules/networks/weak-ssl.ts';
import { noCodeEval } from '../rules/security/no-code-eval.ts';
import { noWeakKeys } from '../rules/security/no-weak-keys.ts';
import { noWeakCipher } from '../rules/security/no-weak-cipher.ts';
import { xmlParserXxe } from '../rules/security/xml-parser-xxe.ts';
import { requireNoopener } from '../rules/web/require-noopener.ts';
import { noHardcodedIp } from '../rules/networks/no-hardcoded-ip.ts';
import { noWeakHashing } from '../rules/security/no-weak-hashing.ts';
import { maxRequestSize } from '../rules/servers/max-request-size.ts';
import { awsEfsUnencrypted } from '../rules/aws/aws-efs-unencrypted.ts';
import { awsOpenAdminPorts } from '../rules/aws/aws-open-admin-ports.ts';
import { awsPublicInstances } from '../rules/aws/aws-public-instances.ts';
import { dynamicTemplates } from '../rules/security/dynamic-templates.ts';
import { awsIamPublicAccess } from '../rules/aws/aws-iam-public-access.ts';
import { insecureJwtToken } from '../rules/security/insecure-jwt-token.ts';
import { noProductionDebug } from '../rules/servers/no-production-debug.ts';
import { awsIamAllPrivileges } from '../rules/aws/aws-iam-all-privileges.ts';
import { noAnyOriginPolicy } from '../rules/servers/no-any-origin-policy.ts';
import { noAnyOriginMessages } from '../rules/web/no-any-origin-messages.ts';
import { unverifiedHostname } from '../rules/networks/unverified-hostname.ts';
import { awsUnencryptedVolumes } from '../rules/aws/aws-unencrypted-volumes.ts';
import { staticBeforeSession } from '../rules/servers/static-before-session.ts';
import { dompurifyUnsafeConfig } from '../rules/web/dompurify-unsafe-config.ts';
import { awsPublicBucketGrants } from '../rules/aws/aws-public-bucket-grants.ts';
import { awsS3BucketVersioning } from '../rules/aws/aws-s3-bucket-versioning.ts';
import { noUnsafeFileUploads } from '../rules/servers/no-unsafe-file-uploads.ts';
import { noDynamicSqlQueries } from '../rules/security/no-dynamic-sql-queries.ts';
import { awsApigatewayPublicApi } from '../rules/aws/aws-apigateway-public-api.ts';
import { awsSqsUnencryptedQueue } from '../rules/aws/aws-sqs-unencrypted-queue.ts';
import { disabledAutoEscaping } from '../rules/security/disabled-auto-escaping.ts';
import { encryptionSecureMode } from '../rules/security/encryption-secure-mode.ts';
import { awsUnencryptedNotebooks } from '../rules/aws/aws-unencrypted-notebooks.ts';
import { noClearTextProtocols } from '../rules/networks/no-clear-text-protocols.ts';
import { unverifiedCertificate } from '../rules/networks/unverified-certificate.ts';
import { requireCsrfMiddleware } from '../rules/servers/require-csrf-middleware.ts';
import { awsSnsUnencryptedTopics } from '../rules/aws/aws-sns-unencrypted-topics.ts';
import { disabledResourceIntegrity } from '../rules/web/disabled-resource-integrity.ts';
import { awsIamPrivilegeEscalation } from '../rules/aws/aws-iam-privilege-escalation.ts';
import { awsUnblockedPublicBuckets } from '../rules/aws/aws-unblocked-public-buckets.ts';
import { awsOpensearchserviceDomain } from '../rules/aws/aws-opensearchservice-domain.ts';
import { noPublicFilePermissions } from '../rules/security/no-public-file-permissions.ts';
import { awsInsecureBucketTransport } from '../rules/aws/aws-insecure-bucket-transport.ts';
import { awsRdsUnencryptedDatabases } from '../rules/aws/aws-rds-unencrypted-databases.ts';
import { reviewBlockchainMnemonic } from '../rules/security/review-blockchain-mnemonic.ts';
import { hardcodedSecretSignatures } from '../rules/security/hardcoded-secret-signatures.ts';
import { requireSessionRegeneration } from '../rules/servers/require-session-regeneration.ts';

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
