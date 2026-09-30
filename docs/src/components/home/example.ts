for (const example of document.querySelectorAll<HTMLElement>('[data-example-root]')) {
    const buttons = example.querySelectorAll<HTMLButtonElement>('[data-example]');
    const panels = example.querySelectorAll<HTMLElement>('[data-example-panel]');
    for (const button of buttons)
        button.addEventListener('click', () => {
            for (const control of buttons) control.setAttribute('aria-pressed', String(control === button));
            for (const panel of panels) panel.hidden = panel.dataset['examplePanel'] !== button.dataset['example'];
        });
}
