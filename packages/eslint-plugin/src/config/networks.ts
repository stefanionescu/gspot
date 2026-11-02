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

export const TLS_CHECKS = {
    'aws_cdk_lib.aws_apigateway.CfnDomainName': [{ path: ['securityPolicy'], required: true, valid: ['TLS_1_2'] }],
    'aws_cdk_lib.aws_apigateway.DomainName': [
        {
            path: ['securityPolicy'],
            required: false,
            validNames: ['aws_cdk_lib.aws_apigateway.SecurityPolicy.TLS_1_2'],
        },
    ],
    'aws_cdk_lib.aws_elasticsearch.CfnDomain': [
        {
            path: ['domainEndpointOptions', 'tlsSecurityPolicy'],
            required: true,
            valid: ['Policy-Min-TLS-1-2-2019-07', 'Policy-Min-TLS-1-2-PFS-2023-10'],
        },
    ],
    'aws_cdk_lib.aws_opensearchservice.Domain': [
        {
            path: ['tlsSecurityPolicy'],
            required: true,
            validNames: [
                'aws_cdk_lib.aws_opensearchservice.TLSSecurityPolicy.TLS_1_2',
                'aws_cdk_lib.aws_opensearchservice.TLSSecurityPolicy.TLS_1_2_PFS',
            ],
        },
    ],
    'aws_cdk_lib.aws_opensearchservice.CfnDomain': [
        {
            path: ['domainEndpointOptions', 'tlsSecurityPolicy'],
            required: true,
            valid: ['Policy-Min-TLS-1-2-2019-07', 'Policy-Min-TLS-1-2-PFS-2023-10'],
        },
    ],
    'aws_cdk_lib.aws_elasticsearch.Domain': [
        {
            path: ['tlsSecurityPolicy'],
            required: true,
            validNames: [
                'aws_cdk_lib.aws_elasticsearch.TLSSecurityPolicy.TLS_1_2',
                'aws_cdk_lib.aws_elasticsearch.TLSSecurityPolicy.TLS_1_2_PFS',
            ],
        },
    ],
} as const;

export const CLEAR_TEXT_CONSTRUCT_CHECKS = {
    'aws_cdk_lib.aws_elasticache.CfnReplicationGroup': [
        { path: ['transitEncryptionEnabled'], required: true, invalid: [false] },
    ],
    'aws_cdk_lib.aws_kinesis.Stream': [
        {
            path: ['encryption'],
            required: false,
            invalidNames: ['aws_cdk_lib.aws_kinesis.StreamEncryption.UNENCRYPTED'],
        },
    ],
    'aws_cdk_lib.aws_kinesis.CfnStream': [{ path: ['streamEncryption'], required: true }],
    'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancer': [
        {
            path: ['listeners', 'externalProtocol'],
            required: false,
            invalidNames: [
                'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancingProtocol.TCP',
                'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancingProtocol.HTTP',
            ],
        },
    ],
    'aws_cdk_lib.aws_elasticloadbalancing.CfnLoadBalancer': [
        { path: ['listeners', 'protocol'], required: false, invalid: ['tcp', 'http'] },
    ],
    'aws_cdk_lib.aws_elasticloadbalancingv2.CfnListener': [
        { path: ['protocol'], required: false, invalid: ['HTTP', 'TCP', 'UDP', 'TCP_UDP'] },
    ],
} as const;

export const CLEAR_TEXT_CALL_CHECKS = {
    'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancer.addListener': [
        {
            path: ['externalProtocol'],
            required: false,
            position: 0,
            invalidNames: [
                'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancingProtocol.TCP',
                'aws_cdk_lib.aws_elasticloadbalancing.LoadBalancingProtocol.HTTP',
            ],
        },
    ],
} as const;

export const CLEAR_TEXT_MESSAGES: Readonly<Record<string, 'transitEncryption' | 'streamEncryption'>> = {
    'aws_cdk_lib.aws_elasticache.CfnReplicationGroup': 'transitEncryption',
    'aws_cdk_lib.aws_kinesis.Stream': 'streamEncryption',
    'aws_cdk_lib.aws_kinesis.CfnStream': 'streamEncryption',
};

const APPLICATION_HTTP = ['aws_cdk_lib.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP'];

const SENSITIVE_PORT_CHECK = { path: ['port'], required: false, invalid: [80, 8080, 8000, 8008] };

const CERTIFICATES_CHECK = { path: ['certificates'], required: true };

export const CLEAR_TEXT_LISTENERS = {
    'aws_cdk_lib.aws_elasticloadbalancingv2.ApplicationLoadBalancer.addListener': {
        kind: 'call',
        position: 1,
        protocols: APPLICATION_HTTP,
        omission: SENSITIVE_PORT_CHECK,
    },
    'aws_cdk_lib.aws_elasticloadbalancingv2.ApplicationListener': {
        kind: 'construct',
        position: 2,
        protocols: APPLICATION_HTTP,
        omission: SENSITIVE_PORT_CHECK,
    },
    'aws_cdk_lib.aws_elasticloadbalancingv2.NetworkLoadBalancer.addListener': {
        kind: 'call',
        position: 1,
        protocols: [
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.HTTP',
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.TCP',
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.UDP',
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.TCP_UDP',
        ],
        omission: CERTIFICATES_CHECK,
    },
    'aws_cdk_lib.aws_elasticloadbalancingv2.NetworkListener': {
        kind: 'construct',
        position: 2,
        protocols: [
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.TCP',
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.UDP',
            'aws_cdk_lib.aws_elasticloadbalancingv2.Protocol.TCP_UDP',
        ],
        omission: CERTIFICATES_CHECK,
    },
} as const;

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
