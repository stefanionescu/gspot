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

export const SEARCH_DOMAINS: ReadonlyMap<
    string | undefined,
    { encryption: string; version: string; isText: boolean; engine: 'OpenSearch' | 'Elasticsearch' }
> = new Map([
    [
        'aws_cdk_lib.aws_opensearchservice.Domain',
        {
            encryption: 'encryptionAtRest',
            version: 'version',
            isText: false,
            engine: 'OpenSearch',
        },
    ],
    [
        'aws_cdk_lib.aws_opensearchservice.CfnDomain',
        {
            encryption: 'encryptionAtRestOptions',
            version: 'engineVersion',
            isText: true,
            engine: 'OpenSearch',
        },
    ],
    [
        'aws_cdk_lib.aws_elasticsearch.Domain',
        {
            encryption: 'encryptionAtRest',
            version: 'version',
            isText: false,
            engine: 'Elasticsearch',
        },
    ],
    [
        'aws_cdk_lib.aws_elasticsearch.CfnDomain',
        {
            encryption: 'encryptionAtRestOptions',
            version: 'elasticsearchVersion',
            isText: true,
            engine: 'Elasticsearch',
        },
    ],
]);

export const SEARCH_ENGINES = [
    ['opensearch', 'OpenSearch'],
    ['elasticsearch', 'Elasticsearch'],
] as const;

export const CDK_PROPS_POSITION = 2;

export const S3_BUCKET = 'aws_cdk_lib.aws_s3.Bucket';

export const POLICY_STATEMENT = 'aws_cdk_lib.aws_iam.PolicyStatement';

export const POLICY_DOCUMENT_FROM_JSON = 'aws_cdk_lib.aws_iam.PolicyDocument.fromJson';

export const POLICY_FROM_JSON = 'aws_cdk_lib.aws_iam.PolicyStatement.fromJson';

export const POLICY_STATEMENTS_KEY = 'Statement';

export const POLICY_CONSTRUCT_KEYS = {
    effect: 'effect',
    allow: 'aws_cdk_lib.aws_iam.Effect.ALLOW',
    actions: 'actions',
    resources: 'resources',
    conditions: 'conditions',
    principals: 'principals',
    isJson: false,
} as const;

export const POLICY_JSON_KEYS = {
    effect: 'Effect',
    allow: 'Allow',
    actions: 'Action',
    resources: 'Resource',
    conditions: 'Condition',
    principals: 'Principal',
    isJson: true,
} as const;

export const PUBLIC_SUBNET = 'aws_cdk_lib.aws_ec2.SubnetType.PUBLIC';

export const PRIVATE_SUBNETS: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_ec2.SubnetType.PRIVATE_ISOLATED',
    'aws_cdk_lib.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS',
    'aws_cdk_lib.aws_ec2.SubnetType.PRIVATE_WITH_NAT',
]);

export const PUBLIC_NETWORK_CHECKS = {
    'aws_cdk_lib.aws_ec2.Instance': [
        {
            path: ['vpcSubnets', 'subnetType'],
            required: false,
            invalidNames: ['aws_cdk_lib.aws_ec2.SubnetType.PUBLIC'],
        },
    ],
    'aws_cdk_lib.aws_rds.CfnDBInstance': [{ path: ['publiclyAccessible'], required: false, invalid: [true] }],
    'aws_cdk_lib.aws_dms.CfnReplicationInstance': [{ path: ['publiclyAccessible'], required: true, invalid: [true] }],
} as const;

export const COMPUTE_INSTANCE = 'aws_cdk_lib.aws_ec2.CfnInstance';

export const RDS_INSTANCE = 'aws_cdk_lib.aws_rds.DatabaseInstance';

export const SUBNET_SELECTION_METHOD = 'selectSubnets';

export const CONNECTION_OWNERS: ReadonlySet<string> = new Set([
    'aws_cdk_lib.aws_docdb.DatabaseCluster.connections',
    'aws_cdk_lib.aws_lambdaPythonAlpha.PythonFunction.connections',
    'aws_cdk_lib.aws_batchAlpha.ComputeEnvironment.connections',
    'aws_cdk_lib.aws_efs.FileSystem.connections',
    'aws_cdk_lib.aws_lambdaGoAlpha.GoFunction.connections',
    'aws_cdk_lib.aws_ecs.ExternalService.connections',
    'aws_cdk_lib.aws_ecs.FargateService.connections',
    'aws_cdk_lib.aws_ecs.Cluster.connections',
    'aws_cdk_lib.aws_ecs.Ec2Service.connections',
    'aws_cdk_lib.aws_elasticsearch.Domain.connections',
    'aws_cdk_lib.aws_neptuneAlpha.DatabaseCluster.connections',
    'aws_cdk_lib.aws_eks.FargateCluster.connections',
    'aws_cdk_lib.aws_eks.Cluster.connections',
    'aws_cdk_lib.aws_codebuild.PipelineProject.connections',
    'aws_cdk_lib.aws_codebuild.Project.connections',
    'aws_cdk_lib.aws_rds.DatabaseInstance.connections',
    'aws_cdk_lib.aws_rds.DatabaseInstanceReadReplica.connections',
    'aws_cdk_lib.aws_rds.DatabaseCluster.connections',
    'aws_cdk_lib.aws_rds.ServerlessClusterFromSnapshot.connections',
    'aws_cdk_lib.aws_rds.DatabaseProxy.connections',
    'aws_cdk_lib.aws_rds.DatabaseInstanceFromSnapshot.connections',
    'aws_cdk_lib.aws_rds.ServerlessCluster.connections',
    'aws_cdk_lib.aws_rds.DatabaseClusterFromSnapshot.connections',
    'aws_cdk_lib.aws_lambdaNodejs.NodejsFunction.connections',
    'aws_cdk_lib.aws_fsx.LustreFileSystem.connections',
    'aws_cdk_lib.aws_ec2.BastionHostLinux.connections',
    'aws_cdk_lib.aws_ec2.ClientVpnEndpoint.connections',
    'aws_cdk_lib.aws_ec2.Instance.connections',
    'aws_cdk_lib.aws_ec2.LaunchTemplate.connections',
    'aws_cdk_lib.aws_ec2.SecurityGroup.connections',
    'aws_cdk_lib.aws_kinesisfirehoseAlpha.DeliveryStream.connections',
    'aws_cdk_lib.aws_stepfunctionsTasks.SageMakerCreateTrainingJob.connections',
    'aws_cdk_lib.aws_stepfunctionsTasks.SageMakerCreateModel.connections',
    'aws_cdk_lib.aws_stepfunctionsTasks.EcsRunTask.connections',
    'aws_cdk_lib.aws_redshiftAlpha.Cluster.connections',
    'aws_cdk_lib.aws_opensearchservice.Domain.connections',
    'aws_cdk_lib.aws_secretsmanager.HostedRotation.connections',
    'aws_cdk_lib.aws_mskAlpha.Cluster.connections',
    'aws_cdk_lib.triggers.TriggerFunction.connections',
    'aws_cdk_lib.aws_autoscaling.AutoScalingGroup.connections',
    'aws_cdk_lib.aws_syntheticsAlpha.Canary.connections',
    'aws_cdk_lib.aws_cloudfront.experimental.EdgeFunction.connections',
    'aws_cdk_lib.aws_lambda.Function.connections',
    'aws_cdk_lib.aws_lambda.DockerImageFunction.connections',
    'aws_cdk_lib.aws_lambda.SingletonFunction.connections',
    'aws_cdk_lib.aws_lambda.Alias.connections',
    'aws_cdk_lib.aws_lambda.Version.connections',
    'aws_cdk_lib.aws_ec2.Connections',
]);

export const ALLOW_FROM = 'allowFrom';

export const ALLOW_FROM_ANY_IPV4 = 'allowFromAnyIpv4';

export const DEFAULT_PORT_FROM = 'aws_cdk_lib.aws_ec2.Connections.allowDefaultPortFrom';

export const DEFAULT_PORT_ANYWHERE = 'aws_cdk_lib.aws_ec2.Connections.allowDefaultPortFromAnyIpv4';

export const INGRESS_RULE = 'aws_cdk_lib.aws_ec2.SecurityGroup.addIngressRule';

export const SECURITY_GROUP = 'aws_cdk_lib.aws_ec2.CfnSecurityGroup';

export const SECURITY_GROUP_INGRESS = 'aws_cdk_lib.aws_ec2.CfnSecurityGroupIngress';

export const ADMIN_PORTS = [22, 3389] as const;

export const OPEN_ADDRESSES = { cidrIp: '0.0.0.0/0', cidrIpv6: '::/0' } as const;

export const ANY_PEERS: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_ec2.Peer.anyIpv4',
    'aws_cdk_lib.aws_ec2.Peer.anyIpv6',
]);

export const ADDRESS_PEERS: ReadonlyMap<string | undefined, string> = new Map([
    ['aws_cdk_lib.aws_ec2.Peer.ipv4', '0.0.0.0/0'],
    ['aws_cdk_lib.aws_ec2.Peer.ipv6', '::/0'],
]);

export const ALL_PORTS: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_ec2.Port.allTcp',
    'aws_cdk_lib.aws_ec2.Port.allTraffic',
]);

export const SINGLE_PORT = 'aws_cdk_lib.aws_ec2.Port.tcp';

export const PORT_RANGE = 'aws_cdk_lib.aws_ec2.Port.tcpRange';

export const PORT_CONSTRUCT = 'aws_cdk_lib.aws_ec2.Port';

export const TCP_PROTOCOL_NAMES: ReadonlySet<string | undefined> = new Set([
    'aws_cdk_lib.aws_ec2.Protocol.ALL',
    'aws_cdk_lib.aws_ec2.Protocol.TCP',
]);

export const TCP_PROTOCOLS: ReadonlySet<unknown> = new Set(['6', 'tcp', 'TCP']);

export const ALL_PROTOCOLS = '-1';

export const REST_API = 'aws_cdk_lib.aws_apigateway.RestApi';

export const ROOT_RESOURCE = 'aws_cdk_lib.aws_apigateway.RestApi.root';

export const RESOURCE_METHODS: ReadonlySet<string> = new Set([
    '',
    'addMethod',
    'addResource',
    'getResource',
    'parentResource',
]);

export const RESOURCE_CHAIN: ReadonlySet<string | null> = new Set(['addMethod', 'addResource', 'root']);

export const ADD_METHOD = 'addMethod';

export const ADD_RESOURCE = 'addResource';

export const NO_AUTHORIZATION = 'aws_cdk_lib.aws_apigateway.AuthorizationType.NONE';

export const METHOD_CHECKS = {
    'aws_cdk_lib.aws_apigateway.CfnMethod': [{ path: ['authorizationType'], required: true, invalid: ['NONE'] }],
    'aws_cdk_lib.aws_apigatewayv2.CfnRoute': [{ path: ['authorizationType'], required: true, invalid: ['NONE'] }],
} as const;
