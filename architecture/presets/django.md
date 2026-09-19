# `django`

Kind: framework. Requires: python. Recommends: pytest, security, postgres.

## Detects

`manage.py`, or `django` in the dependencies of `pyproject.toml`.

## Tools

django-upgrade 1.32.0, through the mise `pipx:` backend. Django itself belongs to the project.

## Generated configuration

The Ruff configuration of the python preset gains the `DJ` family: a text field with `null=True`,
a model with no `__str__`, a form with `exclude` or `fields = "__all__"`, and a `locals()` call as
a render context.

## Checks

| Id                            | Stage       | What it reads                                                                                        |
| ----------------------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `django/upgrade`              | commit      | `django-upgrade --check --target-version <version>`; the fixer runs it without `--check`             |
| `django/migration-names`      | commit      | a file under `migrations/` named `NNNN_auto_<digits>`                                                |
| `django/migration-reversible` | commit      | a `RunPython` with no `reverse_code`, a `RunSQL` with no `reverse_sql`, by position or keyword       |
| `django/settings`             | commit      | `DEBUG = True`, `*` in `ALLOWED_HOSTS`, or `SECRET_KEY` as text, in a settings module a deploy reads |
| `django/migrations-fresh`     | push, build | `manage.py makemigrations --check --dry-run`; one finding for each app Django names                  |

A settings module named `local`, `dev`, `development`, `test`, `testing`, `tests`, or `ci` holds
values for one developer or for the tests, and `django/settings` leaves it alone.

`django/migrations-fresh` runs `manage.py` through `uv run python` where the scope holds a
`uv.lock`, and through `python3` elsewhere. An environment with no Django in it makes the check
missing, not failing.

## Settings

`tools.django.target_version`: the Django version django-upgrade rewrites for. The default, `auto`,
reads it from the dependencies in `pyproject.toml`.

## Rule files

`framework/django/DJANGO.md`.
