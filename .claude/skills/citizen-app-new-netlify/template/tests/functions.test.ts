import { describe, it, expect } from "vitest";
import healthz from "../netlify/functions/healthz.mts";
import me from "../netlify/functions/me.mts";

describe("GET /api/healthz", () => {
  it("returns the heartbeat shape", async () => {
    const body = await (await healthz()).json();
    expect(body.status).toBe("ok");
    expect(typeof body.commit).toBe("string");
    expect(typeof body.startedAt).toBe("string");
  });
});

describe("GET /api/me", () => {
  it("reports unknown when only Netlify team headers are present", async () => {
    const body = await (await me(new Request("http://x/api/me", { headers: { "x-nf-account-id": "abc" } }))).json();
    expect(body.knownToApp).toBe(false);
    expect(body.platformMetadataHeaders).toContain("x-nf-account-id");
  });
});
