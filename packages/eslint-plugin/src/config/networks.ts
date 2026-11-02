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

export const TLS_OPTION_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
    'https.request': [0],
    'request.get': [0],
    'tls.connect': [2],
};

export const WEAK_SSL_OPTION_ARGUMENTS: Readonly<Record<string, readonly number[]>> = {
    'https.request': [0, 1],
    'request.get': [0],
    'tls.connect': [0, 1, 2],
    'tls.createSecureContext': [0],
};

export const WEAK_TLS_VERSIONS: ReadonlySet<unknown> = new Set(['TLSv1.1', 'TLSv1']);

export const TLS_VERSION_OPTIONS = ['minVersion', 'maxVersion'] as const;

export const SECURE_PROTOCOLS: ReadonlySet<unknown> = new Set([
    'TLSv1_2_method',
    'TLSv1_2_client_method',
    'TLSv1_2_server_method',
    'TLS_method',
    'TLS_client_method',
    'TLS_server_method',
]);

export const TLS_CONSTANTS_MODULES: ReadonlySet<string | undefined> = new Set(['constants', 'crypto.constants']);

export const REQUIRED_TLS_FLAGS = ['SSL_OP_NO_TLSv1', 'SSL_OP_NO_TLSv1_1'] as const;

export const SECURE_PROTOCOL_ALTERNATIVES: Readonly<Record<string, string>> = {
    http: 'https',
    ftp: 'sftp, scp, or ftps',
    ws: 'wss',
    telnet: 'ssh',
    gopher: 'https',
    tftp: 'sftp',
    smtp: 'smtps',
    ldap: 'ldaps',
    imap: 'imaps',
    pop3: 'pop3s',
    amqp: 'amqps',
    mqtt: 'mqtts',
    sip: 'sips',
    rtmp: 'rtmps',
    irc: 'ircs',
    nntp: 'nntps',
    stomp: 'stomps',
};

export const PROTOCOL_SEPARATOR = '://';

export const AUTHORITY_END = /[\s#/?]/u;

export const EXEMPT_HOSTS = [
    /^localhost$/u,
    /^127(?:\.\d+){1,3}$/u,
    /^\[(?:0*:){7}:?0*1\]$/u,
    /^\[::1\]$/u,
    /^169\.254\.\d+\.\d+$/u,
    /^\[fd00:ec2::254\]$/u,
    /^168\.63\.129\.16$/u,
    /^100\.100\.100\.200$/u,
    /^metadata(?:\.google)?\.internal$/u,
    /^(?:host|gateway)\.docker\.internal$/u,
    /\.svc\.cluster\.local$/u,
    /(?:^|\.)example\.(?:com|net|org)$/u,
    /\.(?:example|test|localhost)$/u,
] as const;

export const NAMESPACE_HOSTS: ReadonlySet<string> = new Set([
    'www.w3.org',
    'schemas.android.com',
    'schemas.microsoft.com',
    'schemas.xmlsoap.org',
    'www.sap.com',
    'www.opengis.net',
    'hl7.org',
    'unitsofmeasure.org',
    'purl.org',
    'docs.oasis-open.org',
    'xmlns.com',
    'json-ld.org',
    'schema.org',
    'www.springframework.org',
    'maven.apache.org',
    'dublincore.org',
    'ogp.me',
    'xml.apache.org',
    'schemas.openxmlformats.org',
    'rdfs.org',
    'schemas.google.com',
    'a9.com',
    'ns.adobe.com',
    'ltsc.ieee.org',
    'docbook.org',
    'graphml.graphdrawing.org',
    'json-schema.org',
    'cyclonedx.org',
    'snomed.info',
    'adlnet.gov',
    'etherx.jabber.org',
]);

export const NAMESPACE_PATHS: Readonly<Record<string, readonly string[]>> = {
    'jabber.org': ['/protocol/', '/features/'],
};

export const MAIL_TRANSPORT = 'nodemailer.createTransport';

export const ADDRESS_LITERAL_SELECTOR = 'Literal:not(NewExpression[callee.name="URL"] > :nth-child(2))';

export const SECURE_MAIL_PORT = 465;

export const MAIL_SECURE_OPTIONS = [
    'SES',
    'port',
    'secure',
    'service',
    'sendmail',
    'requireTLS',
    'jsonTransport',
    'streamTransport',
] as const;

export const FTP_MODULE = 'ftp';

export const TELNET_IMPORT = 'ImportDeclaration[source.value="telnet-client"]';

export const TELNET_REQUIRE =
    'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.0.value="telnet-client"]';

export const NETMASK_SUFFIX = /\/\d{1,3}$/u;

export const ALLOWED_IP_ADDRESSES: ReadonlySet<string> = new Set([
    '255.255.255.255',
    '::1',
    '::',
    '0:0:0:0:0:0:0:1',
    '0:0:0:0:0:0:0:0',
]);

export const ALLOWED_IP_PREFIXES = ['2001:db8:', '127.', '0.', '2.5', '192.0.2.', '198.51.100.', '203.0.113.'] as const;

export const MAPPED_IPV4_PREFIX = '::ffff:0:';

export const IPV4_OCTETS = 4;

export const OCTAL_OCTET = /^0[0-7]*$/u;

export const HEXADECIMAL_OCTET = /^0x[\da-f]+$/iu;

export const HEXADECIMAL_RADIX = 16;
