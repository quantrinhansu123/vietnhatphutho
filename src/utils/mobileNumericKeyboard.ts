const numericInputSelector = 'input[type="number"]:not([inputmode])';

const addDecimalKeyboardHint = (root: ParentNode | Element) => {
  if (root instanceof HTMLInputElement && root.matches(numericInputSelector)) {
    root.inputMode = 'decimal';
  }

  root.querySelectorAll<HTMLInputElement>(numericInputSelector).forEach(input => {
    input.inputMode = 'decimal';
  });
};

/**
 * Makes every numeric field request a decimal keypad on mobile devices.
 *
 * Existing inputMode declarations are preserved so integer-only fields can
 * continue to request the stricter "numeric" keypad.
 */
export const enableMobileNumericKeyboards = () => {
  addDecimalKeyboardHint(document);

  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes') {
        addDecimalKeyboardHint(mutation.target as Element);
        return;
      }

      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) {
          addDecimalKeyboardHint(node);
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    attributeFilter: ['type'],
    attributes: true,
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};
