import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { openExternalUrl } from '../lib/shopPublicUrl'

type ExternalNavLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'target' | 'rel' | 'onClick'> & {
  href: string
  children: ReactNode
}

/** 後台連到外部網址；iOS 主畫面捷徑會盡量改用 Safari 開啟 */
export function ExternalNavLink({ href, children, ...rest }: ExternalNavLinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    openExternalUrl(href)
  }

  return (
    <a href={href} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}
