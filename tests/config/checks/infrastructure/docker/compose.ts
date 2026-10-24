export const DOCKER_VERSION = '29.0.0';

export const COMPOSE_PAIRING_CASES = [
    { base: 'compose.yaml', override: 'compose.override.yaml' },
    { base: 'compose.yml', override: 'compose.override.yml' },
    { base: 'compose.yaml', override: 'compose.prod.yaml' },
    { base: 'compose.yml', override: 'compose.production.yml' },
    { base: 'docker-compose.yaml', override: 'docker-compose.override.yaml' },
    { base: 'docker-compose.yml', override: 'docker-compose.production.yml' },
] as const;
