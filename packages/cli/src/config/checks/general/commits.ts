export const GIT_COMMIT_MESSAGE_ARGUMENTS = ['show', '--no-patch', '--no-show-signature', '--format=%B'] as const;

export const MESSAGE_FILE = 'message.txt';

export const COMMITLINT_CHECK = 'commits/commitlint';

export const SCISSORS_LINE = '# ------------------------ >8 ------------------------';

export const COMMENT_PREFIX = '#';

export const MESSAGE_REFERENCES = [
    {
        rule: 'session-link',
        pattern: /(?:^Claude-Session:)|claude\.ai\/code\/session_|chatgpt\.com\/(?:c|share)\//iu,
        message: 'links to an AI session. Remove the link: a reader cannot open the chat, and the link shares it.',
    },
] as const;
