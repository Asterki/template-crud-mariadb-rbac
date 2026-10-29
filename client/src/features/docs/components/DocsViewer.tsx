import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type Heading = { id: string; label: string; level: number };

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function extractHeadings(markdown: string): Heading[] {
  const headings: Heading[] = [];
  let inFence = false;

  for (const line of markdown.split("\n")) {
    if (line.trimStart().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{1,4})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    const label = match[2]!
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[`*_~]/g, "")
      .trim();
    const id = slugify(label);
    if (id) headings.push({ id, label, level: match[1]!.length });
  }

  return headings;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 id={slugify(textOf(children))} className="text-3xl font-bold mt-6 mb-3">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 id={slugify(textOf(children))} className="text-2xl font-semibold mt-6 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 id={slugify(textOf(children))} className="text-xl font-semibold mt-5 mb-2">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 id={slugify(textOf(children))} className="text-lg font-semibold mt-4 mb-2">
      {children}
    </h4>
  ),
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc pl-6 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal pl-6 space-y-1">{children}</ol>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 px-3 py-2 font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-300 px-3 py-2 align-top">{children}</td>
  ),
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-md bg-slate-900 p-4 text-sm text-slate-100">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const block = typeof className === "string" && className.includes("language-");
    return (
      <code
        className={
          block
            ? `${className ?? ""} font-mono`
            : "rounded bg-gray-200 px-1 py-0.5 font-mono text-sm dark:bg-gray-700"
        }
      >
        {children}
      </code>
    );
  },
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline dark:text-blue-300"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-4 border-gray-300 pl-4 italic">
      {children}
    </blockquote>
  ),
};

type DocsViewerProps = {
  markdown: string;
  tocLabel: string;
};

export function DocsViewer({ markdown, tocLabel }: DocsViewerProps) {
  const headings = extractHeadings(markdown);

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      {headings.length > 0 ? (
        <nav aria-label={tocLabel} className="lg:sticky lg:top-4 self-start">
          <p className="mb-2 font-semibold">{tocLabel}</p>
          <ul className="space-y-1 text-sm">
            {headings.map((heading) => (
              <li
                key={`${heading.id}-${heading.label}`}
                style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
              >
                <a href={`#${heading.id}`} className="text-blue-600 hover:underline">
                  {heading.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : (
        <span />
      )}
      <article className="dark:text-white">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
