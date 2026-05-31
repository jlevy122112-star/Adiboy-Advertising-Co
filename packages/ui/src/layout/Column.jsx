/**
 * Column.jsx
 * DEV TICKET #9 — Layout Primitive: Column (flex item with width control)
 */
export default function Column({ children, span, maxWidth, className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-column ${className}`}
      style={{
        flex: span ? `0 0 ${span}` : 1,
        maxWidth: maxWidth || undefined,
        minWidth: 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
