import { noPathCommand } from '#eslint-plugin/rules/security/no-path-command.ts';
import { buildRuleTester } from '#tests/setup/eslint/rule-tester.ts';

buildRuleTester().run('no-path-command', noPathCommand, {
    valid: [
        'import { spawn } from "node:child_process"; spawn("/usr/bin/git");',
        String.raw`import { spawn } from "child_process"; spawn("C:\\Tools\\git.exe");`,
        String.raw`import { spawn } from "child_process"; spawn(".\\git.exe");`,
        'import { spawn } from "child_process"; spawn(command);',
        'import { spawn } from "other"; spawn("git");',
        'import child from "child_process"; child.fork("script.js");',
    ],
    invalid: [
        { code: 'import child from "child_process"; child.exec("git");', errors: [{ messageId: 'path' }] },
        {
            code: 'import { spawn as execute } from "node:child_process"; execute("git");',
            errors: [{ messageId: 'path' }],
        },
        {
            code: 'import { spawn } from "child_process"; const command = "git"; spawn(command);',
            errors: [{ messageId: 'path' }],
        },
    ],
});
