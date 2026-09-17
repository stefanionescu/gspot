---
layer: template
preset: none
title: Supabase Deployment
---

# Supabase Deployment

Project template. Copy into `rules/project/` when the repository deploys a Supabase project through scripted remote flows. Edit it to match the project;
gspot never upgrades a project file.

## Remote Deployment

Use the scripted remote flows. Do not hand-run partial remote changes unless the
user explicitly asks for that operation.

Remote flows make each operation explicit: project linking, Vault sync,
database migration push, config push, storage asset sync, Edge Function deploy,
Edge secret sync, and cron scheduling.

If local Supabase configuration changes after initial rollout, deploy that
configuration deliberately rather than relying on a database-only update flow.

Remote deploy scripts validate expected buckets and configured functions.
Keep configuration, deployment scripts, and deployment expectations in sync.


## Flow order

1. Link the project.
2. Sync Vault secrets.
3. Push database migrations.
4. Push configuration.
5. Sync storage assets.
6. Deploy Edge Functions.
7. Sync Edge secrets.
8. Schedule cron jobs.

Each step is its own script or task with its own validation and its own log line. A step that
fails stops the flow; nothing after it runs.
