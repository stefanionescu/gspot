import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

async function checkMessage(message: string): Promise<{ rule: string | undefined; message: string }[]> {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings([]) });
    const messageFile = join(sandbox.path, '.git', 'COMMIT_EDITMSG');
    await writeFile(messageFile, message);
    const session = await openSession(sandbox.path);
    const planned = { ...planSandboxCheck(session, 'commits/references'), messageFile };
    const findings = await getBuiltInCheck('commits/references')(session, planned);
    return findings.map(({ rule, message: text }) => ({ rule, message: text }));
}

test('references reports each line that links to an AI session, and skips comments and the diff below the scissors', async () => {
    const findings = await checkMessage(
        [
            'fix(cli): report the missing configuration',
            '',
            'See https://chatgpt.com/share/abc for the chat.',
            'Co-Authored-By: Claude Opus 5.5 <noreply@example.com>',
            'Claude-Session: https://claude.ai/code/session_01Abc',
            '# claude.ai/code/session_01Abc in a comment',
            '# ------------------------ >8 ------------------------',
            '+Read claude.ai/code/session_01Abc in the diff.',
            '',
        ].join('\n'),
    );
    expect(findings).toStrictEqual([
        {
            rule: 'session-link',
            message:
                'Line 3 links to an AI session. Remove the link: a reader cannot open the chat, and the link shares it.',
        },
        {
            rule: 'session-link',
            message:
                'Line 5 links to an AI session. Remove the link: a reader cannot open the chat, and the link shares it.',
        },
    ]);
});

test('references passes a message with a co-author trailer and links that name no session', async () => {
    const findings = await checkMessage(
        'fix(cli): report the missing configuration\n\nSee https://chatgpt.com/ and https://claude.ai/code.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@example.com>\n',
    );
    expect(findings).toStrictEqual([]);
});
