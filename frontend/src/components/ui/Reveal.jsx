/**
 * Layout wrapper — scroll-reveal motion removed. the design barely
 * animates; staggered fade-ups on every section read as generated UI.
 */
export function Reveal({ children, className = '', as: Tag = 'div' }) {
  return <Tag className={className}>{children}</Tag>
}
