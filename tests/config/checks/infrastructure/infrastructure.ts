const CALLED_WORKFLOW = '.github/workflows/called.yml';

const CALLED_WORKFLOW_REFERENCES = [
    [`$/${CALLED_WORKFLOW}`, `./${CALLED_WORKFLOW}`],
    [`"$/${CALLED_WORKFLOW}"`, `"./${CALLED_WORKFLOW}"`],
    [`'$/${CALLED_WORKFLOW}'`, `'./${CALLED_WORKFLOW}'`],
    [String.raw`"\x24/` + `${CALLED_WORKFLOW}"`, String.raw`"\x2e/` + `${CALLED_WORKFLOW}"`],
    [String.raw`"\u0024/` + `${CALLED_WORKFLOW}"`, String.raw`"\u002e/` + `${CALLED_WORKFLOW}"`],
    [String.raw`"\U00000024/` + `${CALLED_WORKFLOW}"`, String.raw`"\U0000002e/` + `${CALLED_WORKFLOW}"`],
    [`|-\n          $/${CALLED_WORKFLOW}`, `|-\n          ./${CALLED_WORKFLOW}`],
    [`|- # $comment\n          $/${CALLED_WORKFLOW}`, `|- # $comment\n          ./${CALLED_WORKFLOW}`],
    ['$/.github/workflows/$called.yml', './.github/workflows/$called.yml'],
    [
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
        'actions/checkout@08c6903cd8c0fde910a37f88322edcfb5dd907a8 # v5.0.0',
    ],
] as const;

export const ACTIONLINT_EXITS = [
    { code: 0, status: 'passed', findings: [], note: undefined },
    {
        code: 1,
        status: 'failed',
        findings: [{ file: '.github/workflows/caller.yml', rule: 'workflow-call' }],
        note: undefined,
    },
    {
        code: 3,
        status: 'error',
        findings: [],
        note: '<actionlint> failed with exit 3:\n.github/workflows/caller.yml:4:11: located defect [workflow-call]',
    },
] as const;

export const WORKFLOW_TEXT_CASES = [
    ...CALLED_WORKFLOW_REFERENCES.map(([reference, expected]) => ({
        name: `uses ${reference}`,
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${reference}\n`,
        expected: `on: workflow_dispatch\njobs:\n  caller:\n    uses: ${expected}\n`,
    })),
    {
        name: 'a YAML alias',
        path: '.github/workflows/caller.yml',
        before: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow $/${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
        expected: `on: workflow_dispatch\nenv:\n  WORKFLOW: &workflow ./${CALLED_WORKFLOW}\njobs:\n  caller:\n    uses: *workflow\n`,
    },
    {
        name: 'an unclosed flow sequence',
        path: '.github/workflows/caller.yml',
        before: 'uses: [$/unclosed\n',
        expected: 'uses: [$/unclosed\n',
    },
    ...['action.yml', 'action.yaml'].map((filename) => ({
        name: filename,
        path: `.github/actions/setup/${filename}`,
        before: 'name: Setup\nruns:\n  using: composite\n  steps:\n    - uses: $/.github/actions/cache\n',
        expected: 'name: Setup\nruns:\n  using: composite\n  steps:\n    - uses: ./.github/actions/cache\n',
    })),
];

export const OUTSIDE_GITHUB_ACTIONS = {
    '.github/workflows/caller.yml':
        'on: workflow_dispatch\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: $/actions/setup\n',
    'action.yml': 'name: Root\nruns:\n  using: composite\n  steps:\n    - uses: $/actions/setup\n',
    'actions/setup/action.yml':
        'name: Setup\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: echo safe\n',
} as const;

export const NGINX_UPSTREAM_CONF = `events {}
http {
    upstream backend {
        server api:3000;
        server 10.0.0.2:3000;
    }
    server {
        listen 443 ssl;
        server_name example.test;
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        location / {
            proxy_pass http://backend;
        }
    }
}
`;

const DYNAMIC_TARGET_CASE = {
    name: 'dynamic and local targets',
    source: 'events {} http { server { server localhost; server unix:/tmp/socket; server ${upstream}; proxy_pass $url; unrelated api; ssl_certificate $cert; ssl_certificate_key /etc/nginx/key.pem; ssl_trusted_certificate /etc/nginx/cert.pem; ssl_certificate /etc/nginx/cert.pem; } }',
    hosts: [],
    certificates: ['/etc/nginx/key.pem', '/etc/nginx/cert.pem'],
} as const;

export const NGINX_MOUNT_CASES = [
    {
        name: 'certificate paths and upstream hosts',
        source: NGINX_UPSTREAM_CONF,
        hosts: ['api:127.0.0.1', 'backend:127.0.0.1'],
        certificates: ['/etc/nginx/ssl/fullchain.pem', '/etc/nginx/ssl/privkey.pem'],
    },
    DYNAMIC_TARGET_CASE,
] as const;

const NGINX_EMERGENCY_CASES = [
    {
        stderr: 'nginx: [emerg] unknown directive "invalid" in /etc/nginx/conf.d/site.conf:7',
        file: 'conf.d/site.conf',
        line: 7,
    },
    { stderr: 'nginx: [emerg] configuration could not be read', file: 'nginx.conf', line: 1 },
] as const;

export const NGINX_FAILURE_CASES = [
    ...NGINX_EMERGENCY_CASES.map(({ stderr, file, line }) => ({
        name: `an emergency at ${file}:${String(line)}`,
        stderr,
        status: 'failed' as const,
        note: undefined,
        findings: [
            {
                check: 'nginx/syntax',
                file,
                line,
                rule: 'syntax',
                fixable: false,
                message: stderr,
                help: 'Fix the line nginx names. Set `tools.nginx.image` to the one your deployment runs.',
            },
        ],
    })),
    {
        name: 'an unavailable Docker daemon as missing',
        stderr: 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?',
        status: 'missing',
        note: 'Start Docker: nginx/syntax runs nginx -T in a container.',
        findings: [],
    },
] as const;

export const GROUPED_PBXPROJ = `// !$*UTF8*$!
{
    rootObject = P;
    objects = {
        P = {isa = PBXProject; mainGroup = MAIN; targets = (T,); };
        MAIN = {isa = PBXGroup; children = (FIRST, SECOND, ROOT, SYNC,); sourceTree = "<group>"; };
        FIRST = {isa = PBXGroup; name = "Display name"; path = "First Group"; children = (VIRTUAL,); sourceTree = "<group>"; };
        VIRTUAL = {isa = PBXGroup; name = "Virtual display"; children = (F1,); sourceTree = "<group>"; };
        SECOND = {isa = PBXGroup; path = Second; children = (F2,); sourceTree = "<group>"; };
        ROOT = {isa = PBXFileReference; path = Root.swift; sourceTree = SOURCE_ROOT; };
        F1 /* duplicate name */ = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        F2 = {isa = PBXFileReference; path = Shared.swift; sourceTree = "<group>"; };
        B1 = {isa = PBXBuildFile; fileRef = F1; };
        B2 = {isa = PBXBuildFile; fileRef = ROOT; };
        SOURCES = {isa = PBXSourcesBuildPhase; files = (B1, B2,); };
        T = {isa = PBXNativeTarget; buildPhases = (SOURCES,); fileSystemSynchronizedGroups = (SYNC,); };
        SYNC = {isa = PBXFileSystemSynchronizedRootGroup; path = Synced; sourceTree = "<group>"; exceptions = (EXCEPT,); };
        EXCEPT = {isa = PBXFileSystemSynchronizedBuildFileExceptionSet; target = T; membershipExceptions = (Excluded.swift,); };
    };
}
`;

export const BUILD_SETTINGS_PBXPROJ =
    '{rootObject=P;objects={P={isa=PBXProject;};D={isa=XCBuildConfiguration;buildSettings={SDKROOT=macosx;SWIFT_VERSION=6.0;};};};}';

export const ASSET_SETTING_CASES = [
    {
        title: 'An Info.plist image name',
        scope: '',
        path: 'Info.plist',
        text: '<plist><dict><key>UIImageName</key><string>AccentColor</string></dict></plist>\n',
    },
    {
        title: 'A root Xcode project setting',
        scope: '',
        path: 'App.xcodeproj/project.pbxproj',
        text: '{ objects = { CONFIG = { isa = XCBuildConfiguration; buildSettings = { ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; }; }; }; }\n',
    },
    {
        title: 'A root xcconfig setting',
        scope: '',
        path: 'Build.xcconfig',
        text: 'ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor\n',
    },
    {
        title: 'A scoped Xcode project setting',
        scope: 'app/',
        path: 'app/App.xcodeproj/project.pbxproj',
        text: '{ objects = { CONFIG = { isa = XCBuildConfiguration; buildSettings = { ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor; }; }; }; }\n',
    },
] as const;

export const INVALID_RESOURCE_DOCUMENTS = [
    { check: 'xcode/xcstrings', path: 'Localizable.xcstrings', text: 'null' },
    { check: 'xcode/assets', path: 'App/Assets.xcassets/Logo.imageset/Contents.json', text: '{' },
] as const;

export const UNREADABLE_RESOURCES = [
    {
        check: 'xcode/assets',
        path: 'App/Assets.xcassets/Logo.imageset/Contents.json',
        text: '{"images":[{"filename":"logo.png"}]}\n',
    },
] as const;

export const PARTLY_TRANSLATED_STRINGS = {
    sourceLanguage: 'en',
    version: '1.0',
    strings: {
        Hello: { localizations: { fr: { stringUnit: { state: 'translated', value: 'Bonjour' } } } },
        Goodbye: {},
    },
};

export const ENTITLEMENT_SCOPE_RESULTS = [
    { scope: '', status: 'passed' },
    { scope: 'app', status: 'passed' },
    { scope: 'app/child', status: 'failed' },
    { scope: 'sibling', status: 'passed' },
] as const;

const LOGO_CONTENTS = 'App/Assets.xcassets/Logo.imageset/Contents.json';
const LOGO_IMAGE = 'App/Assets.xcassets/Logo.imageset/logo.png';

export const LOGO_IMAGE_SET = {
    contents: LOGO_CONTENTS,
    image: LOGO_IMAGE,
    missingFinding: {
        file: LOGO_CONTENTS,
        line: 1,
        rule: 'missing-image',
        message: 'The image logo.png is not in the set.',
    },
    files: {
        [LOGO_CONTENTS]: '{"images":[{"filename":"logo.png"}]}\n',
        [LOGO_IMAGE]: new Uint8Array([0, 1, 2]),
        'App/Home.swift': 'let logo = Image("Logo")\n',
    },
} as const;

export const SINGLE_FILE_PBXPROJ = GROUPED_PBXPROJ.replace('files = (B1, B2,);', 'files = (B2,);').replace(
    'fileSystemSynchronizedGroups = (SYNC,);',
    '',
);
