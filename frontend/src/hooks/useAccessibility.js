import { useEffect, useRef } from 'react';

export default function useAccessibility() {
  const prevFocusedRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Tab') {
        const focusableElements = document.querySelectorAll(
          'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveFocus = () => {
    prevFocusedRef.current = document.activeElement;
  };

  const restoreFocus = () => {
    if (prevFocusedRef.current) {
      prevFocusedRef.current.focus();
    }
  };

  return { saveFocus, restoreFocus };
}
