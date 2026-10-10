export const DOCKERIGNORE_ENTRIES = ['.git', '.env'];

/** The exit Trivy gives for findings, which its commands set with --exit-code. */
export const TRIVY_EXIT = 10;

export const COMPOSE_OVERRIDE = /^(?<base>compose(?=\.override\.)|docker-compose)\.[^.]+\.ya?ml$/u;
