import { BASH_HEADER, CLEAN_BASH_SCRIPT } from '#tests/config/bash.ts';

export const SWIFT_BARE_BLOCKS = `func report(_ value: Int) {
    do {
        print(value)
    }
    do {
        try check(value)
    } catch {
        print(error)
    }
}
do { print(1) }
`;

export const SWIFT_BLOCKS_FIXED = `func report(_ value: Int) {
    print(value)
    do {
        try check(value)
    } catch {
        print(error)
    }
}
print(1)
`;

export const BASH_ENVIRONMENT_READ_CASES = [
    {
        check: 'structure/environment-readers',
        files: {
            'scripts/environment.sh': `#!/usr/bin/env bash
#
# Owns the environment.
# Runtime: Bash 4.0+, macOS and Linux.

readonly DEPLOY_TARGET="\${1:-}"
`,
            'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "\${DEPLOY_TARGET} $1"
}

main "$@"
`,
        },
        settings: '[structure]\nenvironment_readers = ["scripts/environment.sh"]\n',
        expected: { file: 'scripts/reader.sh', rule: 'read-outside-reader', line: 10 },
        corrected: {
            files: {
                'scripts/environment.sh': '#!/usr/bin/env bash\nreadonly DEPLOY_TARGET="${1:-}"\n',
                'scripts/reader.sh': `${BASH_HEADER}# main: runs the script.
main() {
    echo "$1"
}

main "$@"
`,
            },
        },
    },
] as const;

export const PYTHON_ENVIRONMENT_SOURCE = `import os as system
from os import environ as values, getenv as read
first = system.environ["KEY"]
second = system.getenv("KEY")
third = values["KEY"]
fourth = read("KEY")
# system.environ
literal = 'system.getenv("KEY")'
def local(system):
    return system.environ
def bound():
    values = {}
    return values["KEY"]
from unrelated import getenv as other
fifth = other("KEY")
`;

export const OS_VALUE_SOURCE = 'import os\nVALUE = os.environ["KEY"]\n';

export const FILE_FOLDER_CLASH_CASES = [
    {
        check: 'structure/file-folder-clashes',
        corrected: {
            files: {
                'jobs/turned.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
                'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
            },
        },
        files: {
            'jobs/turn.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/first.sh': CLEAN_BASH_SCRIPT,
            'jobs/turn/second.sh': CLEAN_BASH_SCRIPT,
        },
        expected: {
            file: 'jobs/turn.sh',
            rule: 'file-folder-clash',
            line: 1,
        },
    },
] as const;

const SWIFT_TARGETS_PACKAGE = `// swift-tools-version:5.9
import PackageDescription
let package = Package(
    name: "App",
    targets: [
        .target(name: "Core"),
        .target(name: "Feature", dependencies: ["Core"], path: "Sources/FeatureKit"),
        .testTarget(name: "CoreTests", dependencies: ["Core"]),
    ]
)
`;

export const PYTHON_IMPORT_RULES = `[python]
externals = { value = ["folder_paths"], reason = "The host application supplies this module at runtime." }

[[import_rule]]
name = "core"
paths = ["src/app/core/**"]

[[import_rule]]
name = "storage"
paths = ["src/app/storage/**"]

[[import_rule]]
name = "web"
paths = ["src/app/web/**"]
can_import = ["storage"]
`;

export const PYTHON_IMPORT_FILES = {
    'src/app/__init__.py': '',
    'src/app/core/__init__.py': '',
    'src/app/core/model.py': 'VALUE = 1\n',
    'src/app/core/uses_web.py': 'from app.web import views\n',
    'src/app/storage/__init__.py': '',
    'src/app/storage/db.py': 'from app.core.model import VALUE\n',
    'src/app/web/views.py':
        'import folder_paths\nfrom app.core import model\nfrom app.storage.db import VALUE\nfrom ..core.model import VALUE as AGAIN\nimport requests\n',
    'tests/test_views.py': 'from app.web import views\n',
    'setup.py': '',
} as const;

export const SWIFT_IMPORT_RULES = `[[import_rule]]
name = "core"
paths = ["Sources/Core/**"]

[[import_rule]]
name = "feature"
paths = ["Sources/FeatureKit/**"]
`;

export const SWIFT_IMPORT_FILES = {
    'Package.swift': SWIFT_TARGETS_PACKAGE,
    'Sources/Core/Model.swift': 'import Foundation\nimport Feature\npublic struct Model {}\n',
    'Sources/FeatureKit/View.swift': 'import Core\npublic struct View {}\n',
    'Sources/Loose/Helper.swift': 'public struct Helper {}\n',
    'Tests/CoreTests/ModelTests.swift': 'import Core\n',
} as const;

export const REFUSAL_HELP =
    'Move the code, move that rule above this one, or list the rules it may import in can_import.';

export const UNCOVERED_FILE_MESSAGE =
    'No [[import_rule]] covers this file. Add a path that matches it to an import rule, or record an [[ignore]] for structure/import-rules with its paths and a reason.';

export const SWIFTPM_DEFAULT_FOLDERS = ['Sources', 'Source', 'src', 'srcs'] as const;

export const FRAMEWORK_COMPONENT_CASES = [
    { framework: 'astro', name: 'index.astro', folder: 'src/pages', content: '<main>Example</main>\n' },
    { framework: 'svelte', name: 'Card.svelte', folder: 'src/lib', content: '<p>Example</p>\n' },
] as const;

export const LONE_FILE_TREE = {
    'lone/only.ts': '',
    'typed/one.ts': '',
    'typed/one.d.ts': '',
    'module/one.mts': '',
    'module/one.d.mts': '',
    'pair/first.ts': '',
    'pair/second.ts': '',
    'component/logic.ts': '',
    'component/View.astro': '<main>Example</main>',
    'schema/parser.ts': '',
    'schema/schema.json': '{}',
    'parent/main.ts': '',
    'parent/child/first.ts': '',
    'parent/child/second.ts': '',
    'dist/pkg/lone.ts': '',
    'allowed/only.ts': '',
} as const;

export const ROUTE_FILE_CASES = [
    {
        framework: 'Next.js',
        configurations: ['typescript', 'react', 'react-dom', 'nextjs'],
        files: {
            'app/about/page.tsx': 'export default function About() { return null; }\n',
            'app/api/health/route.ts': 'export function GET() { return new Response("ok"); }\n',
            'app/lone/widget.tsx': 'export const widget = 1;\n',
        },
        expected: 'app/lone/widget.tsx',
    },
    {
        framework: 'SvelteKit',
        configurations: ['typescript', 'svelte'],
        files: {
            'package.json': '{"name":"example","private":true,"type":"module"}\n',
            'src/routes/users/+page.svelte': '<p>Users</p>\n',
            'src/routes/api/+server.ts': 'export function GET() { return new Response("ok"); }\n',
            'src/lib/cards/Card.svelte': '<p>Card</p>\n',
        },
        expected: 'src/lib/cards/Card.svelte',
    },
] as const;

export const LONE_CODE_FILES = [
    'dist/pkg/lone.ts',
    'lone/only.ts',
    'module/one.mts',
    'parent/main.ts',
    'typed/one.ts',
] as const;

export const LONG_PYTHON_FILE = `VALUE_0 = 0
VALUE_1 = 1
VALUE_2 = 2
VALUE_3 = 3
VALUE_4 = 4
VALUE_5 = 5
VALUE_6 = 6
VALUE_7 = 7
VALUE_8 = 8
VALUE_9 = 9
VALUE_10 = 10
VALUE_11 = 11
VALUE_12 = 12`;

export const LONG_JAVASCRIPT_FILE = 'export const values = [\n1,\n2,\n3\n];\n';

export const PREFIX_TREE = {
    'cards/asset-card.ts': '',
    'cards/asset-list.ts': '',
    'cards/asset-row.ts': '',
    'cards/other.ts': '',
    'mixed/turn.ts': '',
    'mixed/turn-flow/first.ts': '',
    'mixed/turn-flow/second.ts': '',
    'fine/index.ts': '',
    'fine/index-page.ts': '',
    'fine/first.ts': '',
    'fine/second.ts': '',
    'components/button.tsx': '',
    'components/button.module.css': '',
    'components/button.test.tsx': '',
    'components/card.tsx': '',
    'paired/api.ts': '',
    'paired/api.d.ts': '',
    'paired/view.mts': '',
    'paired/view.d.mts': '',
    'paired/social.png': '',
    'paired/social.svg': '',
    'npm/package.json': '{}',
    'npm/package-lock.json': '{}',
    'pnpm/pnpm-lock.yaml': '',
    'pnpm/pnpm-workspace.yaml': '',
} as const;

export const NEST_SUFFIX_FILES = {
    'app/jsx.view.tsx': '',
    'app/jsx.service.tsx': '',
    'app/jsx.controller.tsx': '',
    'app/custom.one.ts': '',
    'app/custom.two.ts': '',
    'app/custom.three.ts': '',
};

export const NESTJS_PREFIX_RESULTS: { scope: string; paths: string[] }[] = [
    { scope: '', paths: ['feature.controller.spec.ts'] },
    { scope: 'app', paths: ['app/custom.one.ts', 'app/jsx.controller.tsx'] },
    { scope: 'app/deep', paths: [] },
    { scope: 'sibling', paths: ['sibling/feature.controller.spec.ts'] },
];
