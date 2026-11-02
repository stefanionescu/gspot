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

export const CLEAR_TEXT_MESSAGES: ReadonlyMap<string | undefined, 'transitEncryption' | 'streamEncryption'> = new Map([
    ['aws_cdk_lib.aws_elasticache.CfnReplicationGroup', 'transitEncryption'],
    ['aws_cdk_lib.aws_kinesis.Stream', 'streamEncryption'],
    ['aws_cdk_lib.aws_kinesis.CfnStream', 'streamEncryption'],
]);

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
