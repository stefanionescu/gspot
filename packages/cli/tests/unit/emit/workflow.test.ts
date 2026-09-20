import { describe, expect, test } from 'bun:test';
import { workflowFile } from '#cli/emit/workflow.ts';

describe('workflow action pins', () => {
    test('mise workflows forward check arguments through the configured task', () => {
        const generated = workflowFile({
            version: '0.1.0',
            platforms: ['ubuntu'],
            swiftScope: 'ios',
            isMise: true,
        });
        expect(generated.content).toContain('run: mise run gspot:check --\n');
        expect(generated.content).toContain('mise run gspot:check -- --stage manual');
        expect(generated.content).toContain('mise run gspot:check -- ios');
    });
});
