export const PLUGIN_PREFIX = 'gspot';

export const TYPE_ASSERTION_NODES = [
    'TSAsExpression',
    'TSSatisfiesExpression',
    'TSNonNullExpression',
    'TSTypeAssertion',
    'TSInstantiationExpression',
] as const;

export const UNWRAPPABLE_NODES = ['ChainExpression', ...TYPE_ASSERTION_NODES] as const;

export const IMPORT_SELECTOR =
    'ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression, TSImportType';

export const IMPORT_EQUALS_SELECTOR = 'TSExternalModuleReference';

export const REQUIRE_SELECTOR = 'CallExpression[callee.type="Identifier"][callee.name="require"][arguments.length=1]';

export const MODULE_DECLARATION_NODES = [
    'ImportDeclaration',
    'ExportAllDeclaration',
    'ExportDefaultDeclaration',
    'ExportNamedDeclaration',
] as const;

export const NODE_PREFIX = /^node:/u;

export const MODULE_SEPARATOR = '.';

export const CDK_PROPS_POSITION = 2;

export const S3_BUCKET = 'aws_cdk_lib.aws_s3.Bucket';

export const UNDEFINED_NAME = 'undefined';

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

export const HTML_ELEMENTS: ReadonlySet<string> = new Set([
    'a',
    'abbr',
    'acronym',
    'address',
    'applet',
    'area',
    'article',
    'aside',
    'audio',
    'b',
    'base',
    'basefont',
    'bdi',
    'bdo',
    'bgsound',
    'big',
    'blink',
    'blockquote',
    'body',
    'br',
    'button',
    'canvas',
    'caption',
    'center',
    'cite',
    'code',
    'col',
    'colgroup',
    'command',
    'content',
    'data',
    'datalist',
    'dd',
    'del',
    'details',
    'dfn',
    'dialog',
    'dir',
    'div',
    'dl',
    'dt',
    'element',
    'em',
    'embed',
    'fieldset',
    'figcaption',
    'figure',
    'font',
    'footer',
    'form',
    'frame',
    'frameset',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'head',
    'header',
    'hgroup',
    'hr',
    'html',
    'i',
    'iframe',
    'image',
    'img',
    'input',
    'ins',
    'isindex',
    'kbd',
    'keygen',
    'label',
    'legend',
    'li',
    'link',
    'listing',
    'main',
    'map',
    'mark',
    'marquee',
    'math',
    'menu',
    'menuitem',
    'meta',
    'meter',
    'multicol',
    'nav',
    'nextid',
    'nobr',
    'noembed',
    'noframes',
    'noscript',
    'object',
    'ol',
    'optgroup',
    'option',
    'output',
    'p',
    'param',
    'picture',
    'plaintext',
    'pre',
    'progress',
    'q',
    'rb',
    'rbc',
    'rp',
    'rt',
    'rtc',
    'ruby',
    's',
    'samp',
    'script',
    'search',
    'section',
    'select',
    'shadow',
    'slot',
    'small',
    'source',
    'spacer',
    'span',
    'strike',
    'strong',
    'style',
    'sub',
    'summary',
    'sup',
    'svg',
    'table',
    'tbody',
    'td',
    'template',
    'textarea',
    'tfoot',
    'th',
    'thead',
    'time',
    'title',
    'tr',
    'track',
    'tt',
    'u',
    'ul',
    'var',
    'video',
    'wbr',
    'xmp',
]);

export const TABLE_SECTIONS: ReadonlySet<string> = new Set(['thead', 'tbody', 'tfoot']);

export const TABLE_CELLS: ReadonlySet<string> = new Set(['td', 'th']);

export const MAXIMUM_ROW_SPAN = 65_534;

export const MAXIMUM_COLUMN_SPAN = 1000;

export const BOOLEAN_TEXTS: ReadonlySet<string> = new Set(['true', 'false']);

export const HEADER_SEPARATOR = /\s+/u;

export const LAYOUT_ROLES: ReadonlySet<string> = new Set(['presentation', 'none']);
