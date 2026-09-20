import { describe, expect, test } from 'bun:test';
import { workflowFile } from '#cli/emit/workflow.ts';

describe('workflow action pins', () => {
    test('repository workflows use the checkout commit emitted for adopters', async () => {
        const generated = workflowFile({
            version: '0.1.0',
            platforms: ['ubuntu'],
            swiftScope: undefined,
            isMise: true,
        });
        const checkout = /actions\/checkout@[a-f0-9]{40}\b/u;
        const generatedPins = checkout.exec(generated.content);
        expect(generatedPins).not.toBeNull();
        const expected = generatedPins![0];
        for (const name of ['ci', 'gspot', 'release']) {
            const workflow = await Bun.file(
                new URL(`../../../../../.github/workflows/${name}.yml`, import.meta.url),
            ).text();
            const pins = workflow.match(/actions\/checkout@[^\s]+/gu);
            expect(pins, name).not.toBeNull();
            for (const pin of pins!) expect(pin, name).toBe(expected);
        }
    });
});
