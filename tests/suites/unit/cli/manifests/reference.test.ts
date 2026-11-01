import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/manifests/read.ts';
import { formatDetectionConditions } from '#cli/manifests/reference.ts';

test('detection descriptions keep absent dependencies out of positive evidence', () => {
    const configuration = readConfigurations().get('site');
    if (configuration === undefined) throw new Error('The site configuration must be shipped.');
    const { conditions, exclusions } = formatDetectionConditions(configuration.detect);
    expect(exclusions).toContain('unless `next` is a dependency');
    expect(conditions.join(' ')).not.toContain('`next`');
    expect(conditions.length).toBeGreaterThan(0);
});
