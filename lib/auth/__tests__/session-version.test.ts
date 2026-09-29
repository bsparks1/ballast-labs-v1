import { beforeEach, describe, expect, it, vi } from "vitest";
import { encodeSession } from "@/lib/auth/token";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  sessionVersion: 0,
}));

const storeMock = vi.hoisted(() => ({
  getUserById: vi.fn(),
  incrementSessionVersion: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "ballast_session" && state.cookie !== undefined ? { name, value: state.cookie } : undefined,
    set: (name: string, value: string) => {
      if (name === "ballast_session") state.cookie = value;
    },
    delete: (name: string) => {
      if (name === "ballast_session") state.cookie = undefined;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  store: storeMock,
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import { POST as logoutEverywhere } from "@/app/api/auth/logout-everywhere/route";

const USER_ID = "user-1";
const EMAIL = "ada@ballast.test";

function userRecord() {
  return {
    id: USER_ID,
    email: EMAIL,
    passwordHash: "hash",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    sessionVersion: state.sessionVersion,
  };
}

beforeEach(() => {
  state.cookie = undefined;
  state.sessionVersion = 0;
  storeMock.getUserById.mockImplementation(async (id: string) => (id === USER_ID ? userRecord() : null));
  storeMock.incrementSessionVersion.mockImplementation(async (userId: string) => {
    if (userId !== USER_ID) throw new Error("unknown user");
    state.sessionVersion += 1;
  });
});

describe("session version", () => {
  it("accepts a session whose version matches the user", async () => {
    state.cookie = encodeSession({ userId: USER_ID, email: EMAIL, sessionVersion: 0 });

    await expect(getCurrentUser()).resolves.toEqual({ id: USER_ID, email: EMAIL });
  });

  it("rejects a session whose version is stale", async () => {
    state.sessionVersion = 2;
    state.cookie = encodeSession({ userId: USER_ID, email: EMAIL, sessionVersion: 1 });

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("logout-everywhere increments the version and invalidates the old cookie", async () => {
    const oldCookie = encodeSession({ userId: USER_ID, email: EMAIL, sessionVersion: 0 });
    state.cookie = oldCookie;

    const response = await logoutEverywhere();
    expect(response.status).toBe(200);
    expect(state.sessionVersion).toBe(1);
    expect(storeMock.incrementSessionVersion).toHaveBeenCalledWith(USER_ID);
    expect(state.cookie).toBeUndefined();

    state.cookie = oldCookie;
    await expect(getCurrentUser()).resolves.toBeNull();
  });
});
