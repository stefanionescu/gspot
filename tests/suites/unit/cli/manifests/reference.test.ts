import { test, expect } from 'bun:test';
import { readConfigurations } from '#cli/manifests/read.ts';
import { formatDetectionConditions } from '#cli/manifests/reference.ts';

function describeSelection(name: string): ReturnType<typeof formatDetectionConditions> {
    const configuration = readConfigurations().get(name);
    if (configuration === undefined) throw new Error(`The ${name} configuration must be shipped.`);
    return formatDetectionConditions(configuration.detect);
}

test('detection descriptions join the absent dependencies into one exception', () => {
    const { conditions, exclusions } = describeSelection('site');
    expect(exclusions).toHaveLength(1);
    expect(exclusions[0]).toStartWith('unless the scope depends on `next`, `nuxt`, ');
    expect(conditions.join(' ')).not.toContain('`next`');
    expect(conditions).toContain('a filename `sitemap.xml`');
});

test('detection descriptions write a negated path as an exception and a shebang by its program', () => {
    const docker = describeSelection('docker');
    const javascript = describeSelection('javascript');
    expect(docker.conditions.join(' ')).toEndWith(', except `**/*.dockerignore`');
    expect(docker.conditions.join(' ')).not.toContain('`!');
    expect(javascript.conditions).toContain('a file with a shebang for `node`');
});
