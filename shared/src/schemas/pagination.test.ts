import { describe, expect, it } from "vitest";

import {
  idsSchema,
  pageSizeSchema,
  pageSchema,
  paginationSchema,
} from "./pagination.js";

describe("pagination schemas", () => {
  it("defaults to page 1 and pageSize 20", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces query strings", () => {
    expect(paginationSchema.parse({ page: "3", pageSize: "50" })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it("rejects page 0", () => {
    expect(pageSchema.safeParse("0").success).toBe(false);
  });

  it("rejects pageSize 1000", () => {
    expect(pageSizeSchema.safeParse("1000").success).toBe(false);
  });

  it("accepts at most 100 ids", () => {
    expect(idsSchema.safeParse(Array.from({ length: 100 }, () => "id")).success).toBe(
      true,
    );
    expect(
      idsSchema.safeParse(Array.from({ length: 101 }, () => "id")).success,
    ).toBe(false);
  });
});
