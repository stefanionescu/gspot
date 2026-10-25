export const HASH_SOURCE = '(?:[a-f0-9]{40}|[a-f0-9]{64})';

export const HASH_PATTERN = new RegExp(`^${HASH_SOURCE}$`, 'u');
