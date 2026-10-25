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

export const GUIDE = `# The Guide

The worker retries the request three times. Each retry waits one second.
`;

export const LICENSE = `MIT License

Copyright (c) 2026 Alex Garcia
`;

export const BASH_HEADER = `#!/usr/bin/env bash
#
# Builds the thing.
# Runtime: Bash 4.4+, macOS and Linux.
set -euo pipefail
shopt -s inherit_errexit

`;

export const CLEAN_BASH_SCRIPT = `${BASH_HEADER}# main: runs the script.
main() {
    local name="world"
    local greeting="hello \${name}"
    echo "\${greeting}"
}

main "$@"
`;

export const CLEAN_SWIFT = String.raw`import Foundation

/// Builds the greeting for a person.
public func greeting(for name: String) -> String {
    let person = name.trimmingCharacters(in: .whitespacesAndNewlines)
    if person.isEmpty {
        return "hello"
    }
    return "hello \(person)"
}
`;
