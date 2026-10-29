import { CLEAN_SWIFT } from '#tests/config/swift.ts';

export const SWIFT_SANDBOX = {
    install: false,
    configurations: ['swift', 'naming'],
    files: { 'Sources/App/Greeting.swift': CLEAN_SWIFT },
} as const;
