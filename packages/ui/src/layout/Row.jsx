/**
 * Row.jsx
 * DEV TICKET #9 — Layout Primitive: Row (horizontal flex)
 */
export default function Row({ children, gap = 12, align = 'center', justify = 'flex-start', wrap = false, className = '', style = {}, ...props }) {
  return (
    <div
      className={`ui-row ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap,
        alignItems: align,
        justifyContent: justify,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
