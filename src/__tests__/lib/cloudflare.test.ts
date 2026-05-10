import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock config before importing cloudflare so zoneId/apiToken are predictable
vi.mock("../../config.js", () => ({
  config: {
    cloudflare: {
      apiToken: "test-token",
      zoneId: "test-zone-id",
      accountId: "test-account-id",
      cnameTarget: "proxy.onboardagent.com",
      r2Bucket: "",
      r2AccessKeyId: "",
      r2SecretKey: "",
    },
  },
}));

const { provisionHostname, deprovisionHostname, getHostnameStatus } = await import(
  "../../lib/cloudflare.js"
);

const CF_BASE = "https://api.cloudflare.com/client/v4";
const ZONE = "test-zone-id";

function mockFetch(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    json: async () => ({
      success: ok,
      errors: ok ? [] : [{ message: "CF error message" }],
      result: body,
    }),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch({}));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("provisionHostname", () => {
  it("POSTs to the correct URL with auth header and returns id + status", async () => {
    const fetchMock = mockFetch({ id: "cf-hostname-id", status: "pending" });
    vi.stubGlobal("fetch", fetchMock);

    const result = await provisionHostname("www.mygym.com");

    expect(result).toEqual({ id: "cf-hostname-id", status: "pending" });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CF_BASE}/zones/${ZONE}/custom_hostnames`);
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-token");
    expect(init.method).toBe("POST");

    const parsed = JSON.parse(init.body as string);
    expect(parsed.hostname).toBe("www.mygym.com");
  });

  it("throws with the CF error message when success is false", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    await expect(provisionHostname("www.mygym.com")).rejects.toThrow("CF error message");
  });
});

describe("deprovisionHostname", () => {
  it("sends DELETE to the correct URL", async () => {
    const fetchMock = mockFetch({});
    vi.stubGlobal("fetch", fetchMock);

    await deprovisionHostname("cf-hostname-id");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CF_BASE}/zones/${ZONE}/custom_hostnames/cf-hostname-id`);
    expect(init.method).toBe("DELETE");
  });

  it("throws when success is false", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    await expect(deprovisionHostname("cf-hostname-id")).rejects.toThrow("CF error message");
  });
});

describe("getHostnameStatus", () => {
  it("returns status and ssl_status from the CF result", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: "active", ssl: { status: "active" } }));

    const result = await getHostnameStatus("cf-hostname-id");
    expect(result).toEqual({ status: "active", ssl_status: "active" });
  });

  it("returns ssl_status 'unknown' when ssl is absent", async () => {
    vi.stubGlobal("fetch", mockFetch({ status: "pending" }));

    const result = await getHostnameStatus("cf-hostname-id");
    expect(result.ssl_status).toBe("unknown");
  });

  it("GETs from the correct URL", async () => {
    const fetchMock = mockFetch({ status: "pending", ssl: { status: "pending" } });
    vi.stubGlobal("fetch", fetchMock);

    await getHostnameStatus("cf-hostname-id");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${CF_BASE}/zones/${ZONE}/custom_hostnames/cf-hostname-id`);
    expect(init?.method).toBeUndefined(); // default GET
  });

  it("throws when success is false", async () => {
    vi.stubGlobal("fetch", mockFetch({}, false));
    await expect(getHostnameStatus("cf-hostname-id")).rejects.toThrow("CF error message");
  });
});
