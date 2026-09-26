// The literal values checks/docker reads: names, patterns, limits, and tables.

export const DOCKERIGNORE_ENTRIES = ['.git', 'node_modules', '.env'];
export const FINDINGS_EXIT = 10;
export const SHOWN_FINDINGS = 20;
export const COMPOSE_FILES = [
    '**/docker-compose*.yml',
    '**/docker-compose*.yaml',
    '**/compose*.yml',
    '**/compose*.yaml',
];
