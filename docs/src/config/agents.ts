export const SKILLS_FOLDER = '.well-known/agent-skills/';

export const SKILLS_INDEX_FILE = 'index.json';

export const SKILLS_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';

export const SKILL_FILE = 'SKILL.md';

export const SETUP_SKILL = {
    name: 'gspot',
    description:
        'Set up gspot in a repository, and follow its rules for hooks, checks, exit codes, suppressions, and settings.',
} as const;
