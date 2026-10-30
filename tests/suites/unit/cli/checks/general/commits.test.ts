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

test('references reports finding IDs, plan steps, and issue footers without a number', async () => {
    const findings = await checkMessage(
        [
            'refactor(cli): apply findings C3-BUG-019 and C1-CLN-004',
            '',
            'Record stage 45 in the status.',
            'Do steps 7.01 to 7.36.',
            '',
            'Refs: CI055',
            'Closes: #12',
            'Refs: #12, #13',
            '',
        ].join('\n'),
    );
    expect(findings.map(({ rule, message }) => ({ rule, line: message.split(' ', 2)[1] }))).toStrictEqual([
        { rule: 'finding-id', line: '1' },
        { rule: 'plan-step', line: '3' },
        { rule: 'plan-step', line: '4' },
        { rule: 'issue-footer', line: '6' },
    ]);
});

test('references passes build stages, version numbers, and standard names', async () => {
    const findings = await checkMessage(
        'fix(docker): copy the binary in stage 2 of the build\n\nKeep UTF-8, ISO-8601, and CVE-2024-1234 as written, and require Node 24.15.\n',
    );
    expect(findings).toStrictEqual([]);
});
