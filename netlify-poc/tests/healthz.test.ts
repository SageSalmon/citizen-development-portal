import { describe, it, expect } from "vitest";
import healthz from "../netlify/functions/healthz.mts";

describe("GET /api/healthz", () => {
  it("returns the heartbeat shape", async () => {
    const res = await healthz();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(typeof body.commit).toBe("string");
    expect(typeof body.startedAt).toBe("string");
    expect(body.upstreams).toHaveProperty("netlifyDb");
    expect(body.upstreams).toHaveProperty("fabric");
  });
});
