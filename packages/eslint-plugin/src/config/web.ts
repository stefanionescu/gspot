export const SANITIZE_FUNCTIONS: ReadonlySet<string | undefined> = new Set([
    'dompurify.sanitize',
    'isomorphic-dompurify.sanitize',
]);

export const DANGEROUS_TAGS: ReadonlySet<string> = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'textarea',
    'select',
    'meta',
    'link',
    'style',
    'base',
    'svg',
    'math',
]);

export const DANGEROUS_URI_ATTRIBUTES: ReadonlySet<string> = new Set([
    'href',
    'src',
    'action',
    'formaction',
    'xlink:href',
    'data',
]);

export const EVENT_LISTENER_ATTRIBUTE = /^on[a-z]/iu;

export const SANITIZE_LIST_OPTIONS: Readonly<Record<string, 'tags' | 'events' | 'uris'>> = {
    ADD_TAGS: 'tags',
    ALLOWED_TAGS: 'tags',
    ADD_ATTR: 'events',
    ALLOWED_ATTR: 'events',
    ADD_URI_SAFE_ATTR: 'uris',
};

export const SANITIZE_BOOLEAN_OPTIONS: Readonly<Record<string, boolean>> = {
    ALLOW_UNKNOWN_PROTOCOLS: true,
    WHOLE_DOCUMENT: true,
    SAFE_FOR_XML: false,
    SANITIZE_DOM: false,
    RETURN_TRUSTED_TYPE: false,
};

export const URI_PATTERN_OPTION = 'ALLOWED_URI_REGEXP';

export const SANITIZE_CONFIG_ARGUMENT = 1;

export const LIST_FORMAT = new Intl.ListFormat('en', { type: 'conjunction' });

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

export const WINDOW_OPEN_SELECTOR =
    'CallExpression[callee.type="MemberExpression"][callee.computed=false][callee.property.name="open"]';

export const NO_OPENER_FEATURE = 'noopener';

export const WEB_URL = /^https?:\/\//u;

export const WINDOW_FEATURES_ARGUMENT = 2;

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

export const SECURE_MAIL_PORT = 465;

export const MAIL_SECURE_OPTIONS = ['secure', 'requireTLS', 'port'] as const;

export const FTP_MODULE = 'ftp';

export const TELNET_IMPORT = 'ImportDeclaration[source.value="telnet-client"]';

export const TELNET_REQUIRE =
    'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.0.value="telnet-client"]';

export const WINDOW_TOKEN = /window/iu;

export const MESSAGE_EVENT = 'message';

export const ORIGIN_MEMBER = 'origin';

export const JQUERY_EVENT_MEMBER = 'originalEvent';

export const COMPARED_ORIGIN_DEPTH = 1;

export const COMPARED_EVENT_DEPTH = 2;

export const UNTYPED_TYPES: ReadonlySet<string> = new Set(['any', 'unknown']);

export const WINDOW_MEMBERS = ['postMessage', 'frames'] as const;

export const DOM_LIBRARY_FILE = 'lib.dom.d.ts';

export const WINDOW_RECEIVERS: ReadonlySet<string> = new Set(['window', 'globalThis']);

export const ANY_TARGET_ORIGIN = '*';

export const MESSAGE_LISTENER_PROPERTY = 'onmessage';

export const POST_MESSAGE_SELECTOR =
    'CallExpression:matches([callee.name="postMessage"], [callee.property.name="postMessage"]):matches([arguments.length=2], [arguments.length=3])';

export const ADD_LISTENER_SELECTOR =
    'CallExpression[callee.type="MemberExpression"][callee.property.name="addEventListener"][arguments.length>=2]';

export const ON_MESSAGE_SELECTOR =
    'AssignmentExpression[operator="="][left.type="MemberExpression"][left.computed=false][left.property.name="onmessage"]';

export const SCRIPT_TYPE = 'HTMLScriptElement';

export const VERSIONED_PATH = /\/v?\d+\.\d+(?:\.\d+)?(?:-[\da-z][\d.a-z-]*)?(?=[#/?]|$)/iu;

export const ALIASED_PATH = /\/[^/@]*@[\d.]+(?:-[\da-z][\d.a-z-]*)?(?=[#/?]|$)/iu;

export const REMOTE_PREFIXES = ['http', '//'] as const;

export const CREATE_SCRIPT_SELECTOR =
    'VariableDeclarator[id.type="Identifier"][init.type="CallExpression"][init.callee.object.name="document"][init.callee.property.name="createElement"]';
