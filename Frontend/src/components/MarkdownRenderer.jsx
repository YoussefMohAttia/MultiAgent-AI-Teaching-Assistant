import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MarkdownRenderer({ content, className = '' }) {
  if (!content) return null;

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer noopener"
              className="text-indigo-300 underline decoration-indigo-400/50 underline-offset-2 hover:text-indigo-200"
            />
          ),
          code: ({ inline, className: codeClassName, children, ...props }) =>
            inline ? (
              <code
                {...props}
                className={`rounded bg-slate-800/80 px-1 py-0.5 text-xs text-slate-100 ${codeClassName || ''}`.trim()}
              >
                {children}
              </code>
            ) : (
              <pre className="my-3 overflow-x-auto rounded-lg bg-slate-950/90 p-3">
                <code
                  {...props}
                  className={`text-xs text-slate-100 ${codeClassName || ''}`.trim()}
                >
                  {children}
                </code>
              </pre>
            ),
          p: ({ node, ...props }) => <p {...props} className="mb-3 leading-relaxed last:mb-0" />,
          ul: ({ node, ...props }) => <ul {...props} className="mb-3 list-disc pl-6" />,
          ol: ({ node, ...props }) => <ol {...props} className="mb-3 list-decimal pl-6" />,
          h1: ({ node, ...props }) => <h1 {...props} className="mb-3 mt-4 text-xl font-semibold first:mt-0" />,
          h2: ({ node, ...props }) => <h2 {...props} className="mb-2 mt-4 text-lg font-semibold first:mt-0" />,
          h3: ({ node, ...props }) => <h3 {...props} className="mb-2 mt-3 text-base font-semibold first:mt-0" />,
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="mb-3 border-l-2 border-slate-600 pl-3 text-slate-300/90" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}