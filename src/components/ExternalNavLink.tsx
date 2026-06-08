import type { AnchorHTMLAttributes, ReactNode } from 'react'

type ExternalNavLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'target' | 'rel'
> & {
  href: string
  children: ReactNode
}

/**
 * 後台連到外部網址（新分頁／Safari），不取代目前 ES 系統頁面。
 * 用原生 target="_blank"，iOS 主畫面捷徑跨網域時系統通常會另開 Safari。
 */
export function ExternalNavLink({ href, children, ...rest }: ExternalNavLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  )
}
