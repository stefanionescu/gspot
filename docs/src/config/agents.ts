/** Each docs page has a Markdown copy at its address plus this file name. */
export const MARKDOWN_COPY_FILE = 'index.md';
export const MARKDOWN_TYPE = 'text/markdown';
/** The not-found page gets no Markdown copy. */
export const NOT_FOUND_PAGE = '404';
/** The Markdown copy of the home page repeats llms.txt, the summary for agents. */
export const LLMS_FILE = 'llms.txt';
/** The Agent Skills discovery index: https://github.com/cloudflare/agent-skills-discovery-rfc */
export const SKILLS_FOLDER = '.well-known/agent-skills/';
export const SKILLS_INDEX_FILE = 'index.json';
export const SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
export const SKILL_FILE = 'SKILL.md';
/** The skill holds the steps of llms.txt. */
export const SETUP_SKILL = {
    name: 'gspot',
    description:
        'Set up gspot in a repository, and follow its rules for hooks, checks, exit codes, suppressions, and settings.',
} as const;
