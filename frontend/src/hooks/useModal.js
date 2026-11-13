import { useState, useEffect } from 'react';
import { useAccessibility } from './useAccessibility';

export default function useModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { saveFocus, restoreFocus } = useAccessibility();

  const open = () => {
    saveFocus();
    setIsOpen(true);
  };

  const close = () => {
    restoreFocus();
    setIsOpen(false);
  };

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && isOpen) {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  return { isOpen, open, close };
}
