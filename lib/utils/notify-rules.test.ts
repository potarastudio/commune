import { describe, expect, it } from "vitest";
import type { NotificationLevel } from "@/lib/queries/channels";
import { mentionAnnounces, reasonForMessage } from "./notify-rules";

const ME = "me";
const levels: Record<string, NotificationLevel> = { loud: "all", quiet: "mentions", off: "muted" };
const levelOf = (id: string) => levels[id];
const inChannel = (channel: string, author = "them") => ({ channel_id: channel, conversation_id: null, author_id: author });

describe("reasonForMessage", () => {
  it("announces every message in a channel set to all new messages", () => {
    expect(reasonForMessage(inChannel("loud"), ME, levelOf)).toBe("message");
  });

  it("stays quiet in channels set to mentions or nothing", () => {
    expect(reasonForMessage(inChannel("quiet"), ME, levelOf)).toBeNull();
    expect(reasonForMessage(inChannel("off"), ME, levelOf)).toBeNull();
  });

  it("stays quiet for a channel this person has not joined", () => {
    expect(reasonForMessage(inChannel("someone-elses-public-channel"), ME, levelOf)).toBeNull();
  });

  it("always announces a direct message, whatever the channel settings say", () => {
    expect(reasonForMessage({ channel_id: null, conversation_id: "dm1", author_id: "them" }, ME, levelOf)).toBe("dm");
  });

  it("never announces your own message", () => {
    expect(reasonForMessage(inChannel("loud", ME), ME, levelOf)).toBeNull();
    expect(reasonForMessage({ channel_id: null, conversation_id: "dm1", author_id: ME }, ME, levelOf)).toBeNull();
  });
});

describe("mentionAnnounces", () => {
  it("reaches you in a joined channel, whether it is on all or mentions", () => {
    expect(mentionAnnounces("loud", levelOf)).toBe(true);
    expect(mentionAnnounces("quiet", levelOf)).toBe(true);
  });

  it("does not reach you in a muted channel, or one you have left", () => {
    expect(mentionAnnounces("off", levelOf)).toBe(false);
    expect(mentionAnnounces("never-joined", levelOf)).toBe(false);
  });

  it("reaches you in a direct message, which has no channel", () => {
    expect(mentionAnnounces(null, levelOf)).toBe(true);
  });
});
