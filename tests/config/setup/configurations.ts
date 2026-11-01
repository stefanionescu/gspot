export const COMMAND_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.command: systemctl restart test
      changed_when: true
`;

export const STYLELINT_PACKAGE_JSON = `{
  "name": "native-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

export const STYLELINT_FILES = {
    'package.json': STYLELINT_PACKAGE_JSON,
    'source.css': 'a { opacity: 1; }\n',
    'app/package.json': STYLELINT_PACKAGE_JSON,
    'app/source.css': 'a { opacity: 1; }\n',
    'app/child/package.json': STYLELINT_PACKAGE_JSON,
    'other/package.json': STYLELINT_PACKAGE_JSON,
    'plain/package.json': '{"private":true}\n',
} as const;

export const COMMITLINT_PACKAGE =
    '{"name":"native-project","private":true,"commitlint":{"rules":{"type-enum":[2,"always",["special"]]}},"kept":[0,false,""]}\n';

export const CALLED_WORKFLOW = '.github/workflows/called.yml';

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

export const README = `# Test

A sandbox that holds documents and nothing else.

## Requirements

- git

## Setup

\`\`\`bash
git clone https://example.com/example.git
\`\`\`

## Usage

Open the guide and read it from the top.
`;

export const LICENSE = `MIT License

Copyright (c) 2026 Alex Garcia
`;

export const GUIDE_READ_MARKDOWN = '# Guide\n\nRead the guide.\n';

export const SCHEDULE_RELEASE_MARKDOWN = '# Schedule\n\nRelease on 03/04/2026.\n';

export const NOTES_MARKDOWN = '# Notes\n';

export const FORMAT_OVERRIDES_SETTINGS = `level = "all"\nconfigurations = ["format", "javascript"]\n[rule_files]\nenabled = false\n[format]\nindent_width = 2\nquotes = "double"\nsemicolons = false\n[[format.override]]\npaths = ["tests/**"]\nquotes = "single"\nsemicolons = true\n[[format.override]]\npaths = ["apps/web/**", "!apps/web/exempt.js"]\nquotes = "single"\n[[format.override]]\npaths = ["apps/web/admin/**"]\nquotes = "double"\nsemicolons = true\nline_ending = "crlf"\n[[scope]]\npath = "apps/web"\n[scope.format]\nindent_width = 4\n[[scope]]\npath = "apps/web/admin"\n[scope.format]\nindent_width = 8\n`;

export const PRETTIER_OPTIONS_BY_FILE = [
    { file: 'source.js', tabWidth: 2, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'tests/unit.js', tabWidth: 2, singleQuote: true, semi: true, endOfLine: 'lf' },
    { file: 'apps/web/café note.js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/[special].js', tabWidth: 4, singleQuote: true, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/exempt.js', tabWidth: 4, singleQuote: false, semi: false, endOfLine: 'lf' },
    { file: 'apps/web/admin/page.js', tabWidth: 8, singleQuote: false, semi: true, endOfLine: 'crlf' },
] as const;

export const CONFIG_PROJECT = {
    '.github/workflows/check.yml': `name: Check
on: push
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: echo example
`,
    'package.json': '{"name":"example","private":true,"type":"module"}\n',
    'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src"]}\n',
    'pyproject.toml': `[project]
name = "example"
version = "1.0.0"
`,
    'src/index.ts': 'export const answer = 42;\n',
    'query.sql': 'SELECT 1;\n',
    'nginx.conf': 'events {}\nhttp {}\n',
    'source.swift': 'let answer = 42\n',
    'script.sh': '#!/usr/bin/env bash\nprintf "example\\n"\n',
} as const;

export const NESTED_YAML = 'parent:\n child: value\n';

export const CALLER_WORKFLOW = `on: workflow_dispatch
jobs:
  caller:
    uses: $/.github/workflows/called.yml
`;

export const NPM_CHECK_IGNORES = `[[ignore]]
check = "data-files/v8r"
reason = "This sandbox exercises tools without JSON schema checks."
[[ignore]]
check = "format/editorconfig-checker"
reason = "This sandbox exercises tools without the npm editor checker."
[[ignore]]
check = "format/prettier"
reason = "This sandbox exercises tools without the npm formatter."
`;

export const TWO_WORDS = 'two words';

export const AWS_KEY_ID = 'AKIA' + 'IOSFODNN7' + 'EXAMPLA';

export const TYPO = {
    the: 'teh',
    color: 'colour',
    receive: 'recieve',
    whether: 'wether',
    word: 'wrod',
    spelling: 'speling',
    select: 'SELEC',
} as const;

export const NEXT_MESSAGES = {
    'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
    'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
} as const;

export const VALE_PACKAGES_INI = `StylesPath = ../../../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;
