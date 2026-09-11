import { describe, expect, it } from "vitest";
import { Role } from "./index";

describe("@platform/db exports", () => {
  it("re-exports generated Prisma enums", () => {
    expect(Role.ADMIN).toBe("ADMIN");
    expect(Role.STAFF).toBe("STAFF");
    expect(Role.CUSTOMER).toBe("CUSTOMER");
  });
});
