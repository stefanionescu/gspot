import { noPathCommand } from '#eslint-plugin/rules/security/no-path-command.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-path-command', noPathCommand, {
    valid: [
        'import { spawn } from "node:child_process"; spawn("/usr/bin/git");',
        String.raw`import { spawn } from "child_process"; spawn("C:\\Tools\\git.exe");`,
        String.raw`import { spawn } from "child_process"; spawn(".\\git.exe");`,
        String.raw`import { spawn } from "child_process"; spawn("\\Tools\\git.exe");`,
        'import { spawn } from "child_process"; spawn(command);',
        'import { spawn } from "child_process"; spawn(`git`);',
        'import { spawn } from "child_process"; spawn();',
        'import { spawn } from "child_process"; spawn(42);',
        'import { spawn } from "child_process"; let command = "git"; command = read(); spawn(command);',
        'import { spawn } from "other"; spawn("git");',
        'import { spawn } from "child_process"; function execute(spawn) { spawn("git"); }',
        'import child from "child_process"; child.fork("script.js");',
    ],
    invalid: [
        ...['exec'].map((method) => ({
            code: `import child from "child_process"; child.${method}("git");`,
            errors: [{ messageId: 'path' as const }],
        })),
        ...[
            'import { spawn as execute } from "node:child_process"; execute("git");',
            'const child = require("node:child_process"); child.spawn("git");',
            'const { execFile } = require("child_process"); execFile("git");',
            'import child = require("node:child_process"); child.exec("git status");',
            'import { spawn } from "child_process"; const command = "git"; spawn(command);',
            'import { spawn } from "child_process"; const execute = spawn; execute("git");',
            String.raw`import { spawn } from "child_process"; spawn("D:\\Tools\\git.exe");`,
        ].map((code) => ({ code, errors: [{ messageId: 'path' as const }] })),
    ],
});
