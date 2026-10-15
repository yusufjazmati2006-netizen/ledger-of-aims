import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cx } from '../lib/cx';

/**
 * GitHub-flavoured markdown with raw HTML ignored. Links open in the system browser
 * (the main process routes `target="_blank"` to the shell); images are shown as their
 * alt text, because loading a remote image would be a network request.
 */
const components: Components = {
  a: ({ href, children }) =>
    href && /^https?:\/\//i.test(href) ? (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  img: ({ alt }) => <span className="text-ink-faint">[image{alt ? `: ${alt}` : ''}]</span>,
};

export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cx('markdown', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
