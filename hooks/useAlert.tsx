import React, { useCallback, useState } from 'react';
interface AlertOptions {
  title: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}
export function useAlert() {
  const [alert, setAlert] = useState<AlertOptions & {
    isOpen: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });
  const showAlert = useCallback((options: AlertOptions) => {
    setAlert({
      ...options,
      isOpen: true
    });
  }, []);
  const hideAlert = useCallback(() => {
    setAlert(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);
  return {
    alert,
    showAlert,
    hideAlert
  };
}