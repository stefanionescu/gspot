// The Bash checks that run a tool, on an installed repository: each fires on its defect and accepts the correction.
import { join } from 'node:path';
import { chmodSync } from 'node:fs';
import { BASH_CASES, TOOL_CHECKS } from '#tests/samples/bash.ts';
import { script, plantedCases } from '#tests/harness/planted/cases.ts';

const CLEAN = script.replace('main() {', () => '# main: runs the script.\nmain() {');

plantedCases(
    'the bash configuration',
    {
        kits: ['bash'],
        modules: false,
        without: [],
        tools: ['shellcheck', 'shfmt'],
        files: { 'scripts/build.sh': CLEAN },
        before: (root) => {
            chmodSync(join(root, 'scripts/build.sh'), 0o755);
        },
        corrected: (planted) => ({
            files: Object.fromEntries(Object.keys(planted.files).map((path) => [path, CLEAN])),
        }),
    },
    BASH_CASES.filter((entry) => TOOL_CHECKS.includes(entry.check)),
);
