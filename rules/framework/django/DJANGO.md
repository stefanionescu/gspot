---
layer: framework
preset: django
title: Django
---

# Django

These rules cover Django models, migrations, queries, views, settings, and tests.

## Apps and layout

- One app holds one domain. An app that imports the models of five others is a layer, not a domain.
- Keep business rules in plain functions or services. A view calls them, and a model stores the result.
- Do not put a query in a template, a serializer field, or a property that a template reads in a loop.
- A signal is for a reaction the sender must not know about. For anything else, call the function.

## Models

- Every model has `__str__`, and it returns something a person can tell apart in the admin.
- A text field is never `null=True`. The empty string is the one empty value, except with `unique=True`.
- Name a foreign key for the thing it points to, with no `_id` suffix, and always state `on_delete`.
- State `related_name` on a relation that code reads from the other side.
- Put a rule the database can hold into a constraint: `UniqueConstraint`, `CheckConstraint`.
- Money is a `DecimalField`. Time is timezone-aware, with `USE_TZ = True`.

## Migrations

- Commit every migration with the model change that caused it. `makemigrations --check` passes.
- Name a migration for what it does. Do not keep a name such as `0004_auto_20260101_1200`.
- Never edit a migration that has run outside one machine. Write a new one.
- `RunPython` names its reverse function, and `RunSQL` names its reverse SQL. Use the `noop` of `RunPython` where going back needs no work.
- A data migration reads models through `apps.get_model`, never through an import.
- Split a change that cannot run on a live table: add the nullable column, fill it, then add the constraint.
- Create an index on a large Postgres table with `AddIndexConcurrently`, in a migration that is not atomic.

## Queries

- A list view that touches a relation uses `select_related` or `prefetch_related`. Count the queries in a test.
- Use `exists()` to ask whether rows exist, `count()` to count them, and neither to load them.
- Update many rows with `update()` or `bulk_update`, not with a loop of `save()`.
- Save only the fields that changed: `save(update_fields=[...])`.
- Never build SQL with string formatting. Pass parameters to `raw()`, `extra()`, and the cursor.
- Wrap writes that belong together in `transaction.atomic`, and send mail or a task in `on_commit`.

## Views, forms, and the interface

- Validate every input through a form or a serializer. Never read `request.POST` into a model by hand.
- Check permissions on the object, not only on the view: a logged-in user is not the owner.
- Use `get_object_or_404` for a lookup a client drives.
- A view that changes state accepts `POST`, `PUT`, `PATCH`, or `DELETE`, never `GET`.
- Do not turn off CSRF protection on a view a browser session reaches.
- Do not mark a string safe unless the code that built it escaped every value in it.

## Settings

- Read `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, and every credential from the environment.
- `DEBUG` is off unless the environment turns it on. `ALLOWED_HOSTS` never holds `*` in a deployed module.
- Keep development values in a module named `local`, `dev`, `development`, or `test`.
- Turn on the secure cookie flags, strict transport security, and the redirect to HTTPS in the settings a deploy reads.
- `manage.py check --deploy` passes before a release.

## Tests

- Build test data with factories, not with fixtures that every test shares.
- Use `TestCase` for a test that touches the database, so each test runs in a transaction that rolls back.
- Test a view through the test client, with a user who may and a user who may not.
- Do not call the network in a test. Replace the client at the boundary.
