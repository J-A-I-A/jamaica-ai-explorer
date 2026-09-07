"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Renders assistant Markdown (GitHub-flavored, incl. tables) as formatted HTML.
 * Styling lives in the `.md-body` scope in globals.css so it stays theme-aware.
 * Wide tables scroll horizontally inside their own container.
 */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Assistant answers cite external sources; every one of them opens a
          // new tab, so say so rather than springing the context change.
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer noopener">
              {children}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ),
          table: ({ ...props }) => (
            <div className="md-table-wrap">
              <table {...props} />
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
