/**
 * Container.jsx
 * DEV TICKET #9 — Layout Primitive: Container (max-width wrapper)
 */
export default function Container({ children, maxWidth = 1200, fullWidth = false, className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-container ${className}`}
      style={{
        width: '100%',
        maxWidth: fullWidth ? '100%' : maxWidth,
        marginLeft: 'auto',
        marginRight: 'auto',
        paddingLeft: 16,
        paddingRight: 16,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
