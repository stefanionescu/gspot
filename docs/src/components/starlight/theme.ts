const menus = document.querySelectorAll<HTMLDetailsElement>('[data-theme-menu]');
const choices = document.querySelectorAll<HTMLButtonElement>('.theme-options button');
const system = matchMedia('(prefers-color-scheme: light)');
const stored = localStorage.getItem('starlight-theme');
let preference = stored === 'light' || stored === 'dark' ? stored : 'auto';

function updateTheme(value: string): void {
    preference = value;
    const systemTheme = system.matches ? 'light' : 'dark';
    document.documentElement.dataset['theme'] = value === 'auto' ? systemTheme : value;
    for (const button of choices) button.setAttribute('aria-pressed', String(button.value === value));
    localStorage.setItem('starlight-theme', value === 'auto' ? '' : value);
}

for (const button of choices)
    button.addEventListener('click', () => {
        updateTheme(button.value);
        const menu = button.closest('details');
        if (menu === null) return;
        menu.open = false;
        menu.querySelector('summary')?.focus();
    });

document.addEventListener('click', (event) => {
    for (const menu of menus) if (event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
});
document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    for (const menu of menus) {
        if (!menu.open) continue;
        event.preventDefault();
        menu.open = false;
        menu.querySelector('summary')?.focus();
    }
});
system.addEventListener('change', () => {
    if (preference === 'auto') updateTheme('auto');
});
updateTheme(preference);
