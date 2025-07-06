import { it, expect } from "vitest";
import { getMatches } from "../src/matches";
import type { Route } from "../src/types";

const FolderPage = () => null;
const DocumentPage = () => null;
const FieldPage = () => null;

const routes: Record<string, Route> = {
  home: {
    match: "/~",
    render: FolderPage,
    next: () => [routes.folder, routes.document, routes.template, routes.field],
  },
  folder: {
    match: "/f/:id",
    render: FolderPage,
    next: () => [routes.folder, routes.document, routes.template, routes.field],
  },
  document: {
    match: "/d/:id",
    render: DocumentPage,
    next: () => [routes.field],
  },
  template: {
    match: "/t/:id",
    render: DocumentPage,
    next: () => [routes.field],
  },
  field: {
    match: "/c/:id",
    render: FieldPage,
    next: () => [],
  },
};

const panelRoute: Route = {
  match: (segment: string) => {
    const match = segment.split(/\/~/);
    if (!match[1]) return;
    return `/~${match[1]}`;
  },
  next: () => [panelRoute],
  render: () => null,
  subroutes: Object.values(routes),
};

it("should match dynamic segments", () => {
  expect(
    getMatches("/f/folder1/d/document1/c/field1", Object.values(routes))
  ).toMatchObject([
    { params: { id: "folder1" }, segment: "/f/folder1" },
    { params: { id: "document1" }, segment: "/d/document1" },
    { params: { id: "field1" }, segment: "/c/field1" },
  ]);
});

it("should match segments of nested router", () => {
  expect(
    getMatches("/f/folder1/d/document1/c/field1", [panelRoute])
  ).toMatchObject([
    {
      config: {
        match: "404",
      },
    },
  ]);

  expect(
    getMatches("/~/f/folder1/~/f/folder2/d/document1", [panelRoute])
  ).toMatchObject([
    {
      params: {},
      children: [
        {
          segment: "/~",
        },
        {
          params: { id: "folder1" },
          segment: "/f/folder1",
        },
      ],
      segment: "/~/f/folder1",
      route: "/~/f/folder1",
    },
    {
      params: {},
      children: [
        {
          segment: "/~",
        },
        {
          params: { id: "folder2" },
          segment: "/f/folder2",
        },
        {
          params: { id: "document1" },
          segment: "/d/document1",
        },
      ],
      segment: "/~/f/folder2/d/document1",
      route: "/~/f/folder1/~/f/folder2/d/document1",
    },
  ]);
});
