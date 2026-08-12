export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="header-actions">{actions}</div>}</header>;
}

export function EmptyState({ title, body, action }) {
  return <div className="empty-state"><span>PF</span><h2>{title}</h2><p>{body}</p>{action}</div>;
}

export function ErrorBanner({ message }) {
  return message ? <div className="error-banner" role="alert">{message}</div> : null;
}

export function SuccessBanner({ message }) {
  return message ? <div className="success-banner" role="status">{message}</div> : null;
}

export function StatusPill({ status }) {
  return <span className={`status-pill status-${String(status).toLowerCase().replaceAll('_', '-')}`}>{String(status).replaceAll('_', ' ')}</span>;
}

export function Modal({ title, children, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true"><header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>{children}</section></div>;
}
