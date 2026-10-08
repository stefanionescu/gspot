// Shared authored documents for native-tool and in-process document tests.
export const README = `# Test

A test repository that holds documents and nothing else.

## Requirements

- git

## Setup

\`\`\`bash
git clone https://example.com/example.git
\`\`\`

## Usage

Open the guide and read it from the top.
`;

export const GUIDE = '# The Guide\n\nThe worker retries the request three times. Each retry waits one second.\n';

export const LICENSE = 'MIT License\n\nCopyright (c) 2026 Alex Garcia\n';
export const MISSING_SECTIONS_README = '# A\n# B\n## Table of contents\n\nx\n';
export const SETEXT_README =
    'Thing\n=====\n\nWhat it is.\n\nSetup\n-----\n\n~~~md\n# Example\n## Project structure\n~~~~\n';
