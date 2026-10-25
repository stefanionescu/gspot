import { CLEAN_SWIFT } from '#tests/config/samples.ts';

export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;
