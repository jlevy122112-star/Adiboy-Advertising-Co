/**
 * Button.jsx
 * DEV TICKET #9 — Button Component
 *
 * Variants: primary (solid) | secondary (outline) | ghost (transparent) | icon
 * States: default | hover | active | disabled | loading
 * Sizes: sm | md | lg
 * Supports: left/right icons, full-width mode
 */

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  iconLeft = null,
  iconRight = null,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn--${variant} ui-btn--${size} ${fullWidth ? 'ui-btn--full' : ''} ${loading ? 'ui-btn--loading' : ''} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {iconLeft && <span className="ui-btn__icon-left" aria-hidden="true">{iconLeft}</span>}
      {loading ? (
        <span className="ui-btn__loader" aria-label="Loading" />
      ) : (
        <span className="ui-btn__label">{children}</span>
      )}
      {iconRight && !loading && <span className="ui-btn__icon-right" aria-hidden="true">{iconRight}</span>}
    </button>
  );
}
