import { describe, expect, it } from "vitest";
import { rejectForbiddenOrigin } from "@/lib/http/forbidden-origin";

describe("rejectForbiddenOrigin", () => {
  it("returns 403 for a cross-origin POST", async () => {
    const response = rejectForbiddenOrigin(
      new Request("http://localhost:3000/api/conversation/stream", {
        method: "POST",
        headers: { Origin: "https://evil.example" }
      }),
      "test"
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("allows same-origin requests", () => {
    const response = rejectForbiddenOrigin(
      new Request("http://localhost:3000/api/conversation/stream", {
        method: "POST",
        headers: { Origin: "http://localhost:3000" }
      }),
      "test"
    );

    expect(response).toBeNull();
  });

  it("allows requests without Origin for non-browser clients", () => {
    const response = rejectForbiddenOrigin(new Request("http://localhost:3000/api/conversation/stream"), "test");

    expect(response).toBeNull();
  });
});
