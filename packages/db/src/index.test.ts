import { describe, expect, it } from "vitest";
import { MembershipRole } from "./index";

describe("@platform/db exports", () => {
  it("re-exports generated Prisma enums", () => {
    expect(MembershipRole.OWNER).toBe("OWNER");
    expect(MembershipRole.ADMIN).toBe("ADMIN");
    expect(MembershipRole.STAFF).toBe("STAFF");
    expect(MembershipRole.CUSTOMER).toBe("CUSTOMER");
  });
});
