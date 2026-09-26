// The literal values support/cli reads: names, patterns, limits, and tables.
import type { ExistingTooling } from '#cli/types/repository/repository.ts';

/**
 * The package manifest of the planted project.
 * @param reactDom the react-dom version, aligned with React or not
 * @returns the manifest text
 */
export const NEXT_CONFIG =
    '// The framework configuration.\nconst config = { reactStrictMode: true };\n\nexport default config;\n';
/** The framework configuration with the build check on. */
export const NEXT_PAGE =
    '// The home page.\n\n/**\n * Renders the home page.\n * @returns the page\n */\nexport default function Page(): string {\n    return "home";\n}\n';
/** The root layout. */
export const NEXT_LAYOUT =
    '// The root layout.\nimport type { ReactNode } from \'react\';\n\n/**\n * Wraps every page.\n * @param props the children\n * @param props.children the page\n * @returns the document\n */\nexport default function Layout({ children }: Readonly<{ children: ReactNode }>): ReactNode {\n    return (\n        <html lang="en">\n            <body>{children}</body>\n        </html>\n    );\n}\n';
/** The i18n settings naming the message directory and base locale. */
export const NEXT_TRANSLATIONS = '[tools.i18n]\ntranslations = {directory = "messages", base = "en"}\n';
/** A clean function that every Swift check accepts. */
export const CLEAN_SWIFT =
    'import Foundation\n\n/// Builds the greeting for a person.\npublic func greeting(for name: String) -> String {\n    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)\n    if person.isEmpty {\n        return "hello"\n    }\n    return "hello \\(person)"\n}\n';
/** A force cast SwiftLint reports. */
export const CAST_SWIFT =
    'import Foundation\n\n/// Reads a value as text.\nfunc text(from value: Any) -> NSString {\n    value as! NSString\n}\n';
/** The flags that keep init from touching the runner, hooks, CI, agent rules, and tool installation. */
export const QUIET_INIT = ['--no-runner', '--no-hooks', '--no-ci', '--no-rules', '--no-install'];
export const SITE_BUILD = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;
/** One discovered root Stylelint configuration and nothing else. */
export const STYLELINT_TOOLING: ExistingTooling = {
    configs: [{ tool: 'stylelint', path: '.stylelintrc.json', carries: 'rules-table', check: 'css/stylelint' }],
    hooks: [],
    ci: [],
    agentFiles: [],
    rulesDirectories: [],
    lintFolders: [],
    lintOnlyManifests: [],
    runner: 'none',
};
/** The strict compiler options a planted TypeScript repository reads. */
export const COMPONENT_TSCONFIG =
    '{\n    "compilerOptions": {\n        "strict": true,\n        "noFallthroughCasesInSwitch": true,\n        "noUncheckedIndexedAccess": true,\n        "noImplicitOverride": true,\n        "exactOptionalPropertyTypes": true,\n        "target": "ES2022",\n        "module": "NodeNext",\n        "moduleResolution": "NodeNext",\n        "types": [],\n        "skipLibCheck": true\n    },\n    "include": ["src"]\n}\n';
/** A TypeScript module a planted repository holds, so the compiler has an input. */
export const COMPONENT_SOURCE =
    '// A value the planted files build on.\n\n/** The answer. */\nexport const answer = 42;\n';
/** The first line every planted policy starts from. */
export const MINIMAL_POLICY = 'version = 1\nconfigurations = ["bash"]\n';
/** The mode of an executable fixture. */
export const RUNS = 0o755;
export const NESTED =
    '    if [[ -n "$1" ]]; then\n        for item in "$@"; do\n            while true; do\n                if [[ -n "${item}" ]]; then\n                    case "${item}" in\n                        a) echo a ;;\n                    esac\n                fi\n                break\n            done\n        done\n    fi';
export const HEAD =
    '#!/usr/bin/env bash\n#\n# Builds the thing.\n# Runtime: Bash 4.4+, macOS and Linux.\nset -euo pipefail\nshopt -s inherit_errexit\n\n';
export const BASH_CASES_MAIN = '# main: runs the script.\nmain() {\n    echo "hello $1"\n}\n\nmain "$@"\n';
/** How long a planted-repository test may take: it spawns real tools. */
export const PLANTED_TIMEOUT_MS = 60_000;
