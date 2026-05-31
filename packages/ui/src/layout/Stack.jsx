/**
 * Stack.jsx
 * DEV TICKET #9 — Layout Primitive: Stack (vertical flex)
 */
export default function Stack({ children, gap = 16, align = 'stretch', className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-stack ${className}`}
      style={{ display: 'flex', flexDirection: 'column', gap, alignItems: align, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
