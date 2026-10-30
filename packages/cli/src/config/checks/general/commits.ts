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
    {
        rule: 'finding-id',
        pattern: /\b[A-Z]+\d+-[A-Z]+-\d+\b/u,
        message: 'names a finding ID that a reader of the repository cannot look up. Describe the change itself.',
    },
    {
        rule: 'plan-step',
        pattern: /\b(?:steps? \d+\.\d+|stages? \d{2,})\b/iu,
        message: 'names a step of a plan that a reader of the repository cannot look up. Describe the change itself.',
    },
    {
        rule: 'issue-footer',
        pattern: /^(?:Refs|Closes):(?!.*#\d)/u,
        message: 'has a Refs: or Closes: footer without an issue number. Write it as `Refs: #123`, or remove it.',
    },
] as const;
