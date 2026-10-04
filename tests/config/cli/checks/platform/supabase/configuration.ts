export const SUPABASE_CONFIG =
    'project_id = "example"\n\n[storage.buckets.avatars]\npublic = false\n\n[functions.greet]\nverify_jwt = true\n';

export const MIGRATION = `-- The avatars bucket and who reads it.
CREATE POLICY avatars_read ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
`;

export const GREET = 'Deno.serve(() => new Response("hello"));\n';
