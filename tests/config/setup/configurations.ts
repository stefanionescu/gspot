import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { VALE_PACKAGE_FOLDERS } from '#cli/config/tools/vale.ts';

// ansible
export const COMMAND_PLAYBOOK = `---
- name: Deploy the service
  hosts: all
  tasks:
    - name: Restart the service
      ansible.builtin.command: systemctl restart test
      changed_when: true
`;

// github actions
export const CALLER_WORKFLOW = `on: workflow_dispatch
jobs:
  caller:
    uses: $/.github/workflows/called.yml
`;

// nextjs
export const NEXT_MESSAGES = {
    'messages/en.json': '{\n    "home": { "title": "Home", "greeting": "Hello {name}" }\n}\n',
    'messages/de.json': '{\n    "home": { "title": "Start", "greeting": "Hallo {name}" }\n}\n',
} as const;

// project documents
export const LICENSE = `MIT License

Copyright (c) 2026 Alex Garcia
`;
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

// settings tables
export const LOCAL_PLUGIN_TABLES = `[[tools.eslint.plugins]]
name = "local"
path = "tools/lint/plugin.mjs"
rules = { "no-forbidden" = [] }
`;
export const NPM_CHECK_IGNORES = `[[ignore]]
check = "json/v8r"
reason = "This sandbox exercises tools without JSON schema checks."
[[ignore]]
check = "format/editorconfig-checker"
reason = "This sandbox exercises tools without the npm editor checker."
[[ignore]]
check = "format/prettier"
reason = "This sandbox exercises tools without the npm formatter."
`;

// spelling
export const TYPO = {
    the: 'teh',
    color: 'colour',
    receive: 'recieve',
    whether: 'wether',
    word: 'wrod',
    spelling: 'speling',
    select: 'SELEC',
} as const;

// stylelint
export const STYLELINT_PACKAGE_JSON = `{
  "name": "native-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

// vale
export const EMPTY_VALE_INI = 'Packages =\n';
export const VALE_INSTALLED_FILES = Object.fromEntries(
    VALE_PACKAGE_FOLDERS.map((folder) => [`${GSPOT_PATHS.valePackages}/${folder}/.keep`, '']),
);
export const VALE_PACKAGES_INI = `StylesPath = ../../vale\nPackages = Google, write-good, proselint, alex, Harper\n`;

// xcode projects
export const BUILD_SETTINGS_PBXPROJ =
    '{rootObject=P;objects={P={isa=PBXProject;};D={isa=XCBuildConfiguration;buildSettings={SDKROOT=macosx;SWIFT_VERSION=6.0;};};};}';
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
