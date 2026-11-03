import { describe, expect, it } from "vitest";
import { serviceAccountIn, type ConversationMember } from "./conversations";

const person = (id: string, display_name: string, is_bot = false): ConversationMember => ({
  id,
  display_name,
  handle: id,
  avatar_url: null,
  title: null,
  is_bot,
});
const me = person("hakim", "Hakim Haiman");
const sari = person("sari", "Sari Wijaya");
const hub = person("potara-hub", "Potara Hub", true);

describe("serviceAccountIn", () => {
  it("finds the service account a 1:1 DM is with, which turns its composer off", () => {
    expect(serviceAccountIn([me, hub], me.id)).toBe(hub);
    expect(serviceAccountIn([hub, me], me.id)).toBe(hub);
  });

  it("leaves DMs with people, notes to self and groups alone", () => {
    expect(serviceAccountIn([me, sari], me.id)).toBeNull();
    expect(serviceAccountIn([me], me.id)).toBeNull();
    expect(serviceAccountIn([me, sari, hub], me.id)).toBeNull();
  });

  it("takes members without the flag for people", () => {
    expect(serviceAccountIn([{ id: me.id }, { id: "raka" }], me.id)).toBeNull();
  });
});
