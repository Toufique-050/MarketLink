import { useEffect, useRef, useState } from 'react';

const TOAST_EVENT = 'marketlink:toast';
const CONFIRM_EVENT = 'marketlink:confirm';

export function notify(message, type = 'info') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } }));
}

export function askConfirm({ title = 'Please confirm', message = 'Are you sure?', confirmLabel = 'Confirm', danger = false } = {}) {
  if (typeof window === 'undefined' || typeof window.marketlinkConfirm !== 'function') {
    return Promise.resolve(false);
  }
  return window.marketlinkConfirm({ title, message, confirmLabel, danger });
}

export function UXProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirm, setConfirm] = useState(null);
  const confirmResolver = useRef(null);

  useEffect(() => {
    const onToast = (event) => {
      const detail = event.detail || {};
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((current) => [...current, { id, message: detail.message || 'Done', type: detail.type || 'info' }]);
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 3600);
    };

    const onConfirm = (event) => {
      if (confirmResolver.current) confirmResolver.current(false);
      setConfirm(event.detail || {});
    };

    window.addEventListener(TOAST_EVENT, onToast);
    window.addEventListener(CONFIRM_EVENT, onConfirm);
    window.marketlinkToast = (message, type = 'info') => { window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { message, type } })); };
    window.marketlinkConfirm = (options) => new Promise((resolve) => {
      confirmResolver.current = resolve;
      setConfirm(options);
    });

    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      window.removeEventListener(CONFIRM_EVENT, onConfirm);
      delete window.marketlinkToast;
      delete window.marketlinkConfirm;
    };
  }, []);

  useEffect(() => {
    if (!confirm) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') closeConfirm(false); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [confirm]);

  function closeConfirm(value) {
    if (confirmResolver.current) confirmResolver.current(value);
    confirmResolver.current = null;
    setConfirm(null);
  }

  return (
    <>
      {children}
      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}>×</button>
          </div>
        ))}
      </div>

      {confirm && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeConfirm(false); }}>
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="eyebrow">MARKETLINK</div>
            <h2 id="confirm-title">{confirm.title || 'Please confirm'}</h2>
            <p>{confirm.message || 'Are you sure?'}</p>
            <div className="modal-actions">
              <button type="button" className="button light" onClick={() => closeConfirm(false)}>Cancel</button>
              <button type="button" className={`button ${confirm.danger ? 'danger-button' : ''}`} autoFocus onClick={() => closeConfirm(true)}>{confirm.confirmLabel || 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
