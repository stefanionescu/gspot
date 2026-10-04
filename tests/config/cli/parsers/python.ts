/** Separate project files exercise parser observation and scope isolation. */
export const PYTHON_SOURCES = {
    'api/order.py': 'def total():\n    return 1\n\ncallback = lambda value: value + 1\n',
    'worker/order.py': 'def deliver():\n    first()\n    second()\n    third()\n',
    'generated/order.py': 'def generated():\n    return 0\n',
    'api/readme.md': '# API\n',
};
