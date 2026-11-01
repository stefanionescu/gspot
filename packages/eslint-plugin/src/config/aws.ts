export const EBS_VOLUME_CHECKS = {
    'aws_cdk_lib.aws_ec2.Volume': [{ path: ['encrypted'], required: true, invalid: [false] }],
} as const;

export const SAGEMAKER_NOTEBOOK_CHECKS = {
    'aws_cdk_lib.aws_sagemaker.CfnNotebookInstance': [{ path: ['kmsKeyId'], required: true }],
} as const;

export const SNS_TOPIC_CHECKS = {
    'aws_cdk_lib.aws_sns.Topic': [{ path: ['masterKey'], required: true }],
    'aws_cdk_lib.aws_sns.CfnTopic': [{ path: ['kmsMasterKeyId'], required: true }],
} as const;

export const SQS_QUEUE_CHECKS = {
    'aws_cdk_lib.aws_sqs.Queue': [
        { path: ['encryption'], required: true, invalidNames: ['aws_cdk_lib.aws_sqs.QueueEncryption.UNENCRYPTED'] },
    ],
    'aws_cdk_lib.aws_sqs.CfnQueue': [{ path: ['kmsMasterKeyId'], required: true }],
} as const;

export const EFS_CHECKS = {
    'aws_cdk_lib.aws_efs.FileSystem': [{ path: ['encrypted'], required: false, invalid: [false] }],
    'aws_cdk_lib.aws_efs.CfnFileSystem': [{ path: ['encrypted'], required: true, valid: [true] }],
} as const;

export const S3_DEPLOYMENT = 'aws_cdk_lib.aws_s3_deployment.BucketDeployment';

export const ACCESS_CONTROL_PREFIX = 'aws_cdk_lib.aws_s3.BucketAccessControl.';

export const PUBLIC_ACCESS_CONTROLS: ReadonlySet<string> = new Set([
    'PUBLIC_READ',
    'PUBLIC_READ_WRITE',
    'AUTHENTICATED_READ',
]);

export const GRANT_PUBLIC_ACCESS = 'grantPublicAccess';

export const BLOCK_ACLS_ONLY = 'aws_cdk_lib.aws_s3.BlockPublicAccess.BLOCK_ACLS_ONLY';

export const BLOCK_PUBLIC_ACCESS = 'aws_cdk_lib.aws_s3.BlockPublicAccess';

export const BLOCK_PUBLIC_ACCESS_KEYS: ReadonlySet<string> = new Set([
    'blockPublicAcls',
    'blockPublicPolicy',
    'ignorePublicAcls',
    'restrictPublicBuckets',
]);

export const ANY_PRINCIPAL = '*';

export const ANY_PRINCIPALS: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_iam.StarPrincipal',
    'aws_cdk_lib.aws_iam.AnyPrincipal',
]);

export const ARN_PRINCIPAL = 'aws_cdk_lib.aws_iam.ArnPrincipal';

export const JSON_PRINCIPAL_KEY = 'AWS';

export const ESCALATION_RESOURCE = /^(?:\*|arn:[^:]*:[^:]*:[^:]*:[^:]*:(?:role|user|group)\/\*)$/u;

export const ESCALATION_ACTIONS: ReadonlySet<string> = new Set([
    'cloudformation:CreateStack',
    'datapipeline:CreatePipeline',
    'datapipeline:PutPipelineDefinition',
    'ec2:RunInstances',
    'glue:CreateDevEndpoint',
    'glue:UpdateDevEndpoint',
    'iam:AddUserToGroup',
    'iam:AttachGroupPolicy',
    'iam:AttachRolePolicy',
    'iam:AttachUserPolicy',
    'iam:CreateAccessKey',
    'iam:CreateLoginProfile',
    'iam:CreatePolicyVersion',
    'iam:PassRole',
    'iam:PutGroupPolicy',
    'iam:PutRolePolicy',
    'iam:PutUserPolicy',
    'iam:SetDefaultPolicyVersion',
    'iam:UpdateAssumeRolePolicy',
    'iam:UpdateLoginProfile',
    'lambda:AddPermission',
    'lambda:CreateEventSourceMapping',
    'lambda:CreateFunction',
    'lambda:InvokeFunction',
    'lambda:UpdateFunctionCode',
    'sts:AssumeRole',
]);

export const RDS_STORAGES: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_rds.CfnDBCluster',
    'aws_cdk_lib.aws_rds.CfnDBInstance',
    'aws_cdk_lib.aws_rds.DatabaseCluster',
    'aws_cdk_lib.aws_rds.DatabaseClusterFromSnapshot',
    'aws_cdk_lib.aws_rds.DatabaseInstance',
    'aws_cdk_lib.aws_rds.DatabaseInstanceReadReplica',
]);

export const RDS_KEYED_STORAGES: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_rds.DatabaseCluster',
    'aws_cdk_lib.aws_rds.DatabaseClusterFromSnapshot',
    'aws_cdk_lib.aws_rds.DatabaseInstance',
    'aws_cdk_lib.aws_rds.DatabaseInstanceReadReplica',
]);

export const KMS_KEYS: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_kms.Key',
    'aws_cdk_lib.aws_kms.Alias',
]);

export const SEARCH_DOMAINS: Readonly<
    Record<string, { encryption: string; version: string; isText: boolean; engine: 'OpenSearch' | 'Elasticsearch' }>
> = {
    'aws_cdk_lib.aws_opensearchservice.Domain': {
        encryption: 'encryptionAtRest',
        version: 'version',
        isText: false,
        engine: 'OpenSearch',
    },
    'aws_cdk_lib.aws_opensearchservice.CfnDomain': {
        encryption: 'encryptionAtRestOptions',
        version: 'engineVersion',
        isText: true,
        engine: 'OpenSearch',
    },
    'aws_cdk_lib.aws_elasticsearch.Domain': {
        encryption: 'encryptionAtRest',
        version: 'version',
        isText: false,
        engine: 'Elasticsearch',
    },
    'aws_cdk_lib.aws_elasticsearch.CfnDomain': {
        encryption: 'encryptionAtRestOptions',
        version: 'elasticsearchVersion',
        isText: true,
        engine: 'Elasticsearch',
    },
};

export const SEARCH_ENGINES = [
    ['opensearch', 'OpenSearch'],
    ['elasticsearch', 'Elasticsearch'],
] as const;
