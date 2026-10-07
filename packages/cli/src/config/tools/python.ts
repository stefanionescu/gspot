import { UV_INSTALLER } from '#cli/config/configurations.ts';

/** Arguments shared by uv execution and its installation preview. */
export const UV_LOCK_ARGUMENTS = ['lock'] as const;
export const UV_VENV_ARGUMENTS = ['venv', '--relocatable', '.venv'] as const;
export const UV_INSTALL_ARGUMENTS = ['sync', '--locked', '--no-install-project'] as const;
/** The exact mise tool requested before Python lock resolution. */
export const UV_MISE_PIN = `${UV_INSTALLER.name}@${UV_INSTALLER.version}`;
/** A uv acquisition command independent of the Python tool environment of gspot. */
export const UV_ACQUISITION = `python -m pip install uv==${UV_INSTALLER.version}`;
