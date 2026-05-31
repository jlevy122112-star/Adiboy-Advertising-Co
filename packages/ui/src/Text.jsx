/**
 * Text.jsx + Heading.jsx
 * DEV TICKET #9 — Typography Components
 *
 * Text: semantic span/p with weight, size, color, truncation
 * Heading: semantic h1–h4 with display font option
 */

/**
 * Text — body/caption/label typography
 */
export function Text({
  children,
  as: Tag = 'p',
  size = 'md',
  weight = 'regular',
  color,
  truncate = false,
  mono = false,
  className = '',
  style = {},
  ...props
}) {
  const sizeMap = {
    lg:  '1rem',
    md:  '0.875rem',
    sm:  '0.75rem',
    xs:  '0.625rem',
  };
  const weightMap = {
    light:   300,
    regular: 400,
    medium:  500,
    bold:    700,
  };

  return (
    <Tag
      className={`ui-text ui-text--${size} ${className}`}
      style={{
        fontSize: sizeMap[size] || sizeMap.md,
        fontWeight: weightMap[weight] || 400,
        color: color || 'inherit',
        fontFamily: mono ? "'Share Tech Mono', monospace" : "'DM Sans', sans-serif",
        overflow: truncate ? 'hidden' : undefined,
        textOverflow: truncate ? 'ellipsis' : undefined,
        whiteSpace: truncate ? 'nowrap' : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}

/**
 * Heading — display/section headings
 */
export function Heading({
  children,
  level = 2,
  display = false,
  size,
  color,
  letterSpacing,
  className = '',
  style = {},
  ...props
}) {
  const Tag = `h${level}`;
  const defaultSizes = { 1: '2.5rem', 2: '2rem', 3: '1.5rem', 4: '1.25rem' };

  return (
    <Tag
      className={`ui-heading ui-heading--${level} ${className}`}
      style={{
        fontFamily: display ? "'Bebas Neue', sans-serif" : "'DM Sans', sans-serif",
        fontSize: size || defaultSizes[level] || '1.5rem',
        fontWeight: display ? 400 : 600,
        letterSpacing: letterSpacing || (display ? '3px' : 'normal'),
        color: color || 'inherit',
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
