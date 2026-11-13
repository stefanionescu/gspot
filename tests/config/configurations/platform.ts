// cloudflare
export const CLOUDFLARE_HEADERS = `  Header-before-path: value
# Comment
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: same-origin
  Content-Security-Policy: frame-ancestors none
/assets/*
  X-Frame-Options: INVALID
  No colon
assets/*
  X-Robots-Tag: noindex
`;
export const CLOUDFLARE_REDIRECTS = `/old /new 200
/old /new
/old /new 404
/old /new 302!
/lonely
old /new 301
/old http://legacy.example/new 301
/old new 301
`;
export const SECURITY_HEADER_CASES = [
    {
        name: 'missing content type protection',
        text: '/*\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n',
        missing: ['x-content-type-options'],
    },
    {
        name: 'no global block',
        text: '/assets/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n',
        missing: ['x-content-type-options', 'referrer-policy', 'x-frame-options'],
    },
    {
        name: 'a detached unrelated header',
        text: '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  ! X-Powered-By\n',
        missing: [],
    },
] as const;

// supabase
export const AVATARS_BUCKET_CONFIG = '[storage.buckets.avatars]\npublic = false\n';
export const SERVICE_KEY_SETTINGS = `configurations = ["supabase"]
test_files = ["qa/**"]
[[scope]]
path = "apps/web"

test_files = ["qa/**", "verification/**"]
`;
export const STORAGE_POLICIES = [
    {
        name: 'dropped policy',
        sql: "CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars'); DROP POLICY p ON storage.objects;",
        allowed: false,
    },
    {
        name: 'altered policy',
        sql: "CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars'); ALTER POLICY p ON storage.objects USING (bucket_id = 'other');",
        allowed: false,
    },
    {
        name: 'owner comparison',
        sql: "CREATE POLICY p ON storage.objects USING (owner_id = 'avatars');",
        allowed: false,
    },
    {
        name: 'bucket inequality',
        sql: "CREATE POLICY p ON storage.objects USING (bucket_id <> 'avatars');",
        allowed: false,
    },
    {
        name: 'negated condition',
        sql: "CREATE POLICY p ON storage.objects USING (NOT (bucket_id = 'avatars'));",
        allowed: false,
    },
    {
        name: 'qualified bucket list',
        sql: "CREATE POLICY p ON storage.objects USING (objects.bucket_id IN ('avatars', 'other'));",
        allowed: true,
    },
    {
        name: 'alter preserves with check',
        sql: "CREATE POLICY p ON storage.objects WITH CHECK (bucket_id = 'avatars'); ALTER POLICY p ON storage.objects TO authenticated;",
        allowed: true,
    },
    {
        name: 'unrelated table',
        sql: "CREATE POLICY p ON public.objects USING (bucket_id = 'avatars');",
        allowed: false,
    },
    {
        name: 'unrelated statement',
        sql: "CREATE POLICY p ON storage.objects USING (true); SELECT 'avatars';",
        allowed: false,
    },
    {
        name: 'quoted identifier',
        sql: 'CREATE POLICY p ON storage.objects USING ("avatars" = bucket_id);',
        allowed: false,
    },
    {
        name: 'literal on the left',
        sql: "CREATE POLICY p ON storage.objects USING ('avatars' = bucket_id);",
        allowed: true,
    },
    {
        name: 'with check array',
        sql: "CREATE POLICY p ON storage.objects WITH CHECK (bucket_id = ANY(ARRAY['other', 'avatars']));",
        allowed: true,
    },
] as const;
