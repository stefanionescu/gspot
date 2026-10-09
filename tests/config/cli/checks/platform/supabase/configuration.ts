export const SUPABASE_CONFIG =
    'project_id = "example"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

export const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;

/** Policy statements that distinguish native bucket literals from unrelated source text. */
export const STORAGE_POLICIES = [
    {
        name: 'comment only',
        sql: "-- CREATE POLICY p ON storage.objects USING (bucket_id = 'avatars');\n",
        allowed: false,
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
        name: 'quoted relation and literal',
        sql: 'CREATE POLICY p ON "storage"."objects" USING (bucket_id = \'avatars\');',
        allowed: true,
    },
    {
        name: 'with check array',
        sql: "CREATE POLICY p ON storage.objects WITH CHECK (bucket_id = ANY(ARRAY['other', 'avatars']));",
        allowed: true,
    },
];
