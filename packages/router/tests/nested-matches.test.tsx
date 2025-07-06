import { it, expect } from "vitest";
import { Link } from "../src/Link";
import { NestedRoutes } from "../src/routes/nested";
import { ParallelRoutes } from "../src/routes/parallel";
import { getMatches } from "../src/matches";
import type { Route } from "../src/types";

const FolderPage = ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) => (
  <div>
    <div>FOLDER {params.id}</div>
    <div>
      <Link to="/~/d/hello">link 1</Link>
    </div>
    <div>{children}</div>
  </div>
);

const DocumentPage = ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) => (
  <div>
    <div>DOCUMENT {params.id}</div>
    <div>
      <Link to="/~">link 2</Link>
    </div>
    <div>{children}</div>
  </div>
);

const ordinaryRoutes: Record<string, Route> = {
  home: {
    match: "/~",
    render: FolderPage,
    next: () => [
      ordinaryRoutes.folder,
      ordinaryRoutes.document,
      ordinaryRoutes.template,
      ordinaryRoutes.field,
    ],
  },
  folder: {
    match: "/f/:id",
    render: FolderPage,
    next: () => [
      ordinaryRoutes.folder,
      ordinaryRoutes.document,
      ordinaryRoutes.template,
      ordinaryRoutes.field,
    ],
  },
  document: {
    match: "/d/:id",
    render: DocumentPage,
    next: () => [ordinaryRoutes.field],
  },
};

const panelRoutes: Route[] = [
  {
    match: (segment: string) => {
      const match = segment.split(/\/~/);
      if (match[1] === undefined) return;
      return `/~${match[1]}`;
    },
    render: () => (
      <div>
        Panel <NestedRoutes />
      </div>
    ),
    next: () => panelRoutes,
    subroutes: Object.values(ordinaryRoutes),
  },
];

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div>
      Layout
      {children}
    </div>
  );
};

const panelRoute: Route = {
  match: "/~.*",
  render: () => (
    <div style={{ display: "flex" }}>
      <ParallelRoutes />
    </div>
  ),
  subroutes: panelRoutes,
};

const topRoutes: Route[] = [
  {
    match: "/:slug/:version([^~/]+)",
    render: Layout,
    next: () => [panelRoute],
  },
  {
    match: "/:slug",
    render: Layout,
    next: () => [panelRoute],
  },
];

it("should match", () => {
  const matches = getMatches("/hej/~/f/hej", topRoutes);
  console.log("MATCHES", matches);
  expect(matches).toMatchObject([
    {
      segment: "/hej",
      accumulated: "/hej",
      params: {
        slug: "hej",
      },
    },
    {
      segment: "/~/f/hej",
      accumulated: "/hej/~/f/hej",
      children: [
        {
          segment: "/~/f/hej",
          children: [
            {
              segment: "/~",
            },
            {
              segment: "/f/hej",
            },
          ],
          params: {},
          accumulated: "/~/f/hej",
        },
      ],
    },
  ]);
});
