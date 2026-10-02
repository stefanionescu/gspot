// Where a profile is fetched from: an https address as given, a GitHub shorthand mapped to its raw file, never http.
import { test, spyOn, expect } from 'bun:test';
import { getProfile } from '#cli/policy/profiles/parse.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { RAW_HOST, PROFILE_FILE } from '#cli/config/policy/profiles.ts';

const PROFILE = 'profile = "house"\nselection = "exact"\nkits = ["bash"]\n';

test.each([
    ['https://example.com/house.profile.toml', 'https://example.com/house.profile.toml'],
    ['github:acme/policies', `${RAW_HOST}/acme/policies/HEAD/${PROFILE_FILE}`],
    ['github:acme/policies/team/house.profile.toml@v2', `${RAW_HOST}/acme/policies/v2/team/house.profile.toml`],
])('%s is fetched from %s', async (source, address) => {
    using fetched = spyOn(globalThis, 'fetch').mockResolvedValue(new Response(PROFILE));
    const profile = await getProfile(source, '.');
    expect(fetched.mock.calls[0]?.[0]).toBe(address);
    expect(profile.tables.kits).toStrictEqual(['bash']);
});

test('a profile address that answers 404 is refused with its status', async () => {
    using fetched = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Not found', { status: 404 }));
    expect(await rejection(getProfile('github:acme/missing', '.'))).toContain('answered 404');
    expect(fetched).toHaveBeenCalledTimes(1);
});

test('a profile address over plain http is refused before any request', async () => {
    using fetched = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No request is expected.'));
    // eslint-disable-next-line unicorn/prefer-https -- reason: The test hands the reader the plain http address it refuses.
    expect(await rejection(getProfile('http://example.com/house.profile.toml', '.'))).toContain('https, not http');
    expect(fetched).not.toHaveBeenCalled();
});
