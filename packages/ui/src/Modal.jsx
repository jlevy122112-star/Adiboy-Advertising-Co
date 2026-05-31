/**
 * Panel.jsx
 * DEV TICKET #9 — Panel Component
 * Used for viewer sidebars. Subtle border + shadow.
 */
export function Panel({ children, className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-panel ${className}`}
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-5)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card.jsx
 * DEV TICKET #9 — Card Component
 * Used for artifact cards. Hover glow. Pressed state.
 */
export function Card({ children, onClick, hoverable = false, accentColor, className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-card ${hoverable ? 'ui-card--hoverable' : ''} ${className}`}
      style={{
        background: 'var(--color-surface)',
        border: '0.5px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-4)',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        ...(accentColor ? {
          borderTop: `2px solid ${accentColor}`,
        } : {}),
        ...style,
      }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Modal.jsx
 * DEV TICKET #9 — Modal Component
 * Used for Export, Share, Settings. Backdrop blur. Centered layout.
 */
export function Modal({ children, onClose, title, className = '', ...props }) {
  return (
    <div
      className="ui-modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className={`ui-modal ${className}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          border: '0.5px solid var(--color-border-2)',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: 480,
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'modalIn 200ms var(--ease-out)',
        }}
        {...props}
      >
        {title && (
          <div className="ui-modal__header">
            <div className="ui-modal__title">{title}</div>
            {onClose && (
              <button className="ui-modal__close" onClick={onClose} aria-label="Close">✕</button>
            )}
          </div>
        )}
        <div className="ui-modal__body">{children}</div>
      </div>
    </div>
  );
}
