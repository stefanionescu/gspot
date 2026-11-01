import { csrf } from './rules/csrf.ts';
import { hashing } from './rules/hashing.ts';
import { weakSsl } from './rules/weak-ssl.ts';
import { codeEval } from './rules/code-eval.ts';
import { sqlQueries } from './rules/sql-queries.ts';
import { noWeakKeys } from './rules/no-weak-keys.ts';
import { fileUploads } from './rules/file-uploads.ts';
import { postMessage } from './rules/post-message.ts';
import { noWeakCipher } from './rules/no-weak-cipher.ts';
import { xmlParserXxe } from './rules/xml-parser-xxe.ts';
import { contentLength } from './rules/content-length.ts';
import { noHardcodedIp } from './rules/no-hardcoded-ip.ts';
import { filePermissions } from './rules/file-permissions.ts';
import { productionDebug } from './rules/production-debug.ts';
import { requireNoopener } from './rules/require-noopener.ts';
import { dynamicTemplates } from './rules/dynamic-templates.ts';
import { insecureJwtToken } from './rules/insecure-jwt-token.ts';
import { awsEfsUnencrypted } from './rules/aws-efs-unencrypted.ts';
import { crossOriginPolicy } from './rules/cross-origin-policy.ts';
import { awsOpenAdminPorts } from './rules/aws-open-admin-ports.ts';
import { unverifiedHostname } from './rules/unverified-hostname.ts';
import { awsPublicInstances } from './rules/aws-public-instances.ts';
import { awsIamPublicAccess } from './rules/aws-iam-public-access.ts';
import { sessionRegeneration } from './rules/session-regeneration.ts';
import { staticBeforeSession } from './rules/static-before-session.ts';
import { awsIamAllPrivileges } from './rules/aws-iam-all-privileges.ts';
import { disabledAutoEscaping } from './rules/disabled-auto-escaping.ts';
import { encryptionSecureMode } from './rules/encryption-secure-mode.ts';
import { noClearTextProtocols } from './rules/no-clear-text-protocols.ts';
import { unverifiedCertificate } from './rules/unverified-certificate.ts';
import { awsUnencryptedVolumes } from './rules/aws-unencrypted-volumes.ts';
import { dompurifyUnsafeConfig } from './rules/dompurify-unsafe-config.ts';
import { awsPublicBucketGrants } from './rules/aws-public-bucket-grants.ts';
import { awsS3BucketVersioning } from './rules/aws-s3-bucket-versioning.ts';
import { awsApigatewayPublicApi } from './rules/aws-apigateway-public-api.ts';
import { awsSqsUnencryptedQueue } from './rules/aws-sqs-unencrypted-queue.ts';
import { awsUnencryptedNotebooks } from './rules/aws-unencrypted-notebooks.ts';
import { awsSnsUnencryptedTopics } from './rules/aws-sns-unencrypted-topics.ts';
import { reviewBlockchainMnemonic } from './rules/review-blockchain-mnemonic.ts';
import { disabledResourceIntegrity } from './rules/disabled-resource-integrity.ts';
import { hardcodedSecretSignatures } from './rules/hardcoded-secret-signatures.ts';
import { awsIamPrivilegeEscalation } from './rules/aws-iam-privilege-escalation.ts';
import { awsUnblockedPublicBuckets } from './rules/aws-unblocked-public-buckets.ts';
import { awsOpensearchserviceDomain } from './rules/aws-opensearchservice-domain.ts';
import { awsInsecureBucketTransport } from './rules/aws-insecure-bucket-transport.ts';
import { awsRdsUnencryptedDatabases } from './rules/aws-rds-unencrypted-databases.ts';

/**
The rules that flag weak cryptography, turned-off TLS checks, queries and templates built from strings, unsafe Express
settings, and secrets in the code.
*/
export const securityRules = {
    'xml-parser-xxe': xmlParserXxe,
    'weak-ssl': weakSsl,
    'no-weak-keys': noWeakKeys,
    csrf: csrf,
    'unverified-certificate': unverifiedCertificate,
    'cross-origin-policy': crossOriginPolicy,
    'unverified-hostname': unverifiedHostname,
    'encryption-secure-mode': encryptionSecureMode,
    'no-weak-cipher': noWeakCipher,
    'insecure-jwt-token': insecureJwtToken,
    'hardcoded-secret-signatures': hardcodedSecretSignatures,
    'static-before-session': staticBeforeSession,
    hashing: hashing,
    'sql-queries': sqlQueries,
    'file-uploads': fileUploads,
    'file-permissions': filePermissions,
    'production-debug': productionDebug,
    'content-length': contentLength,
    'disabled-resource-integrity': disabledResourceIntegrity,
    'session-regeneration': sessionRegeneration,
    'no-hardcoded-ip': noHardcodedIp,
    'code-eval': codeEval,
    'post-message': postMessage,
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
