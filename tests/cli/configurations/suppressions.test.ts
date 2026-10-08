// Each tool's suppression definition finds its own comment and reads a reason only where the comment gives one.
import { test, expect } from 'bun:test';
import { configurationManifests } from '#cli/configurations/public.ts';
import { SUPPRESSION_REASONS } from '#tests/config/cli/configurations/suppressions.ts';

test.each(SUPPRESSION_REASONS)(
    'the %s configuration reads %s suppressions and their reasons',
    (configuration, tool, bare, explained, expected) => {
        const definition = configurationManifests()
            .get(configuration)!
            .tools.find(({ name }) => name === tool)!.suppression!;
        const marker = new RegExp(definition.marker, 'u');
        const reason = new RegExp(definition.reason, 'u');
        expect(marker.test(bare)).toBe(true);
        expect(marker.test(explained)).toBe(true);
        expect(reason.exec(bare)?.groups?.['reason']).toBeUndefined();
        expect(reason.exec(explained)?.groups?.['reason']).toBe(expected);
    },
);
