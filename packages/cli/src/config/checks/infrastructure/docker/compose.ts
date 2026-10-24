export const COMPOSE_OVERRIDE = /^(?<base>compose|docker-compose)\.[^.]+\.ya?ml$/u;

export const COMPOSE_SUFFIXES = ['.yaml', '.yml'] as const;

export const COMPOSE_CHECK = 'docker/compose';

export const COMPOSE_FILE_FLAG = '-f';
