import { describe, expect, it } from "vitest";
import { avatarUrlAllowed, handleProblem, isOwnAvatarUpload, normaliseHandle } from "./profile";

describe("normaliseHandle", () => {
  it("lowercases, replaces spaces and strips junk", () => {
    expect(normaliseHandle("Hakim Haiman")).toBe("hakim-haiman");
    expect(normaliseHandle("__Sari!!")).toBe("sari");
    expect(normaliseHandle("raka.p")).toBe("raka.p");
  });
  it("caps at 30 characters", () => {
    expect(normaliseHandle("a".repeat(40))).toHaveLength(30);
  });
});

describe("handleProblem", () => {
  it("accepts valid handles", () => {
    expect(handleProblem("hakim")).toBeNull();
    expect(handleProblem("h4k1m.h-2_")).toBeNull();
  });
  it("rejects empty, bad start, bad chars and reserved words", () => {
    expect(handleProblem("")).toMatch(/Pick/);
    expect(handleProblem("-x")).toMatch(/Start/);
    expect(handleProblem("Hakim")).toMatch(/lowercase/);
    expect(handleProblem("channel")).toMatch(/reserved/);
  });
});

describe("avatarUrlAllowed", () => {
  const supabaseUrl = "https://lbxytfatdrhqcfvepzhb.supabase.co";
  const me = "0b5c2a8e-1f3d-4c6a-9e7b-2d4f6a8c0e12";
  const them = "7d9e1f3a-5b7c-4d9e-8f1a-3b5c7d9e1f3a";
  const upload = (who: string, file = "avatar.png") => `${supabaseUrl}/storage/v1/object/public/avatars/${who}/${file}`;
  const google = "https://lh3.googleusercontent.com/a/ACg8ocK-probe=s96-c";
  const allowed = (next: string | null | undefined, current: string | null = null) =>
    avatarUrlAllowed(next, { current, userId: me, supabaseUrl });

  it("keeps whatever the profile already has, so a new Google user can finish setup", () => {
    expect(allowed(google, google)).toBe(true);
    expect(allowed("https://api.dicebear.com/9.x/notionists/svg?seed=hakim", "https://api.dicebear.com/9.x/notionists/svg?seed=hakim")).toBe(true);
  });

  it("allows leaving the avatar alone or removing it", () => {
    expect(allowed(undefined, google)).toBe(true);
    expect(allowed(null, google)).toBe(true);
  });

  it("allows the user's own upload, with or without the cache-busting query", () => {
    expect(allowed(upload(me))).toBe(true);
    expect(allowed(`${upload(me)}?v=1757600000000`, google)).toBe(true);
    expect(allowed(upload(me, "avatar.jpeg"))).toBe(true);
  });

  it("refuses someone else's upload", () => {
    expect(allowed(upload(them))).toBe(false);
    expect(allowed(upload(them), google)).toBe(false);
  });

  it("refuses a new outside URL, even a Google one, unless it is already on the profile", () => {
    expect(allowed(google)).toBe(false);
    expect(allowed(google, "https://lh3.googleusercontent.com/a/older-photo=s96-c")).toBe(false);
    expect(allowed("https://evil.example/cat.png")).toBe(false);
  });

  it("is not fooled by the folder appearing somewhere other than the path of this project's storage", () => {
    // The old rule only searched the URL for "/avatars/<id>/", so these passed.
    expect(allowed(`https://evil.example/storage/v1/object/public/avatars/${me}/avatar.png`)).toBe(false);
    expect(allowed(`https://evil.example/cat.png?/avatars/${me}/`)).toBe(false);
    expect(allowed(`https://evil.example/cat.png#/avatars/${me}/`)).toBe(false);
    expect(allowed(`${supabaseUrl}@evil.example/storage/v1/object/public/avatars/${me}/avatar.png`)).toBe(false);
    expect(allowed(`${supabaseUrl}/storage/v1/object/public/attachments/${me}/avatar.png`)).toBe(false);
  });

  it("is not fooled by climbing out of the user's folder", () => {
    expect(allowed(upload(me, `../${them}/avatar.png`))).toBe(false);
    expect(allowed(upload(me, `%2e%2e/${them}/avatar.png`))).toBe(false);
    expect(allowed(upload(me, `x/../../${them}/avatar.png`))).toBe(false);
    expect(allowed(upload(me, `..%2F${them}%2Favatar.png`))).toBe(false);
    expect(allowed(upload(me, "nested/avatar.png"))).toBe(false);
  });

  it("never treats an empty profile as a match", () => {
    expect(avatarUrlAllowed("", { current: null, userId: me, supabaseUrl })).toBe(false);
  });
});

describe("isOwnAvatarUpload", () => {
  it("works against the local stack's URL as well as the hosted one", () => {
    const me = "c5dfab90-e17d-4dbb-83ee-b13e395fee2a";
    const local = "http://127.0.0.1:54321";
    expect(isOwnAvatarUpload(`${local}/storage/v1/object/public/avatars/${me}/avatar.webp?v=1`, me, local)).toBe(true);
    expect(isOwnAvatarUpload(`http://localhost:54321/storage/v1/object/public/avatars/${me}/avatar.webp`, me, local)).toBe(false);
    expect(isOwnAvatarUpload("not a url", me, local)).toBe(false);
  });
});
