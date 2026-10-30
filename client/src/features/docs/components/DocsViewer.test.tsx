import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DocsViewer, extractHeadings } from "./DocsViewer";

const markdown = `# Guide

| Name | Value |
|---|---|
| Alpha | One |

\`\`\`js
const answer = 42;
\`\`\`

<script>window.__docsXss = true;</script>
`;

describe("DocsViewer", () => {
  it("renders markdown tables and code blocks", () => {
    render(<DocsViewer markdown={markdown} tocLabel="On this page" />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("One")).toBeInTheDocument();
    expect(screen.getByText(/const answer = 42/)).toBeInTheDocument();
    expect(screen.getByText("On this page")).toBeInTheDocument();
  });

  it("does not render script tags from markdown", () => {
    const { container } = render(
      <DocsViewer markdown={markdown} tocLabel="On this page" />,
    );

    expect(container.querySelector("script")).toBeNull();
    expect((window as unknown as { __docsXss?: boolean }).__docsXss).toBeUndefined();
  });

  it("builds a table of contents and ignores headings in code fences", () => {
    const headings = extractHeadings(
      "# Title\n\n## Section\n\n```\n# not-a-heading\n```\n",
    );

    expect(headings).toEqual([
      { id: "title", label: "Title", level: 1 },
      { id: "section", label: "Section", level: 2 },
    ]);
  });
});
