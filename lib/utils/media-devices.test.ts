import { describe, expect, it } from "vitest";
import { checkedRow, cleanDeviceLabel, deviceRows, devicesHidden, findRemembered, rememberedDevices } from "./media-devices";

const d = (kind: MediaDeviceKind, deviceId: string, label: string) => ({ kind, deviceId, label });

describe("cleanDeviceLabel", () => {
  it("drops USB vendor and product ids, and nothing else", () => {
    expect(cleanDeviceLabel("Logitech BRIO (046d:085e)")).toBe("Logitech BRIO");
    expect(cleanDeviceLabel("MacBook Pro Microphone (Built-in)")).toBe("MacBook Pro Microphone (Built-in)");
    expect(cleanDeviceLabel("  AirPods Pro  ")).toBe("AirPods Pro");
  });
});

describe("deviceRows", () => {
  // What Chrome on a Mac returns with a USB camera and AirPods connected.
  const chrome = [
    d("audioinput", "default", "Default - AirPods Pro (Bluetooth)"),
    d("audioinput", "a1", "MacBook Pro Microphone (Built-in)"),
    d("audioinput", "a2", "AirPods Pro (Bluetooth)"),
    d("audiooutput", "default", "Default - MacBook Pro Speakers (Built-in)"),
    d("audiooutput", "o1", "MacBook Pro Speakers (Built-in)"),
    d("videoinput", "v1", "FaceTime HD Camera (05ac:8514)"),
    d("videoinput", "v2", "Logitech BRIO (046d:085e)"),
  ];

  it("puts the system default first, naming the device it currently is", () => {
    expect(deviceRows(chrome, "audioinput")).toEqual([
      { id: "default", label: "System default", detail: "AirPods Pro (Bluetooth)" },
      { id: "a1", label: "MacBook Pro Microphone (Built-in)" },
      { id: "a2", label: "AirPods Pro (Bluetooth)" },
    ]);
  });

  it("keeps kinds apart and cleans camera names", () => {
    expect(deviceRows(chrome, "videoinput")).toEqual([
      { id: "v1", label: "FaceTime HD Camera" },
      { id: "v2", label: "Logitech BRIO" },
    ]);
    expect(deviceRows(chrome, "audiooutput").map((r) => r.label)).toEqual(["System default", "MacBook Pro Speakers (Built-in)"]);
  });

  it("leaves out Windows' communications twin", () => {
    const windows = [
      d("audioinput", "default", "Default - Headset (Jabra)"),
      d("audioinput", "communications", "Communications - Headset (Jabra)"),
      d("audioinput", "h1", "Headset (Jabra)"),
    ];
    expect(deviceRows(windows, "audioinput").map((r) => r.id)).toEqual(["default", "h1"]);
  });

  it("numbers devices the browser has not named yet", () => {
    const unnamed = [d("videoinput", "v1", ""), d("videoinput", "v2", ""), d("audioinput", "default", "")];
    expect(deviceRows(unnamed, "videoinput").map((r) => r.label)).toEqual(["Camera 1", "Camera 2"]);
    expect(deviceRows(unnamed, "audioinput")).toEqual([{ id: "default", label: "System default" }]);
  });

  it("offers nothing it cannot select, and says when the browser is hiding devices", () => {
    const safari = [d("videoinput", "", ""), d("audioinput", "m1", "iPhone Microphone")];
    expect(deviceRows(safari, "videoinput")).toEqual([]);
    expect(devicesHidden(safari, "videoinput")).toBe(true);
    expect(devicesHidden(safari, "audioinput")).toBe(false);
    expect(devicesHidden([], "videoinput")).toBe(false);
  });
});

describe("checkedRow", () => {
  const rows = [
    { id: "default", label: "System default" },
    { id: "a1", label: "MacBook Pro Microphone" },
  ];
  it("checks the active device when it is listed", () => {
    expect(checkedRow(rows, "a1")).toBe("a1");
  });
  it("falls back to the system default, then to the first row", () => {
    expect(checkedRow(rows, "unplugged")).toBe("default");
    expect(checkedRow(rows, undefined)).toBe("default");
    expect(checkedRow([{ id: "v1", label: "Camera 1" }], "")).toBe("v1");
    expect(checkedRow([], "x")).toBeUndefined();
  });
});

describe("findRemembered", () => {
  const today = [
    d("audioinput", "default", "Default - MacBook Pro Microphone"),
    d("audioinput", "new-id-1", "MacBook Pro Microphone"),
    d("audioinput", "new-id-2", "AirPods Pro"),
    d("videoinput", "cam-9", "AirPods Pro"),
  ];

  it("keeps the id when the browser still uses it", () => {
    expect(findRemembered({ id: "new-id-2", label: "Something else" }, today, "audioinput")).toBe("new-id-2");
    expect(findRemembered({ id: "default", label: "Default - AirPods Pro" }, today, "audioinput")).toBe("default");
  });

  it("finds the same device by name when the browser has issued new ids since", () => {
    expect(findRemembered({ id: "old-id", label: "AirPods Pro" }, today, "audioinput")).toBe("new-id-2");
  });

  it("never matches a name across kinds, onto the default entry, or when there is no name", () => {
    expect(findRemembered({ id: "old-cam", label: "AirPods Pro" }, [d("audioinput", "new-id-2", "AirPods Pro")], "videoinput")).toBeUndefined();
    expect(findRemembered({ id: "old", label: "Default - MacBook Pro Microphone" }, today, "audioinput")).toBeUndefined();
    expect(findRemembered({ id: "old", label: "" }, today, "audioinput")).toBeUndefined();
    expect(findRemembered(undefined, today, "audioinput")).toBeUndefined();
  });
});

describe("rememberedDevices", () => {
  const plugged = [d("audioinput", "default", "Default - AirPods Pro"), d("audioinput", "a2", "AirPods Pro"), d("videoinput", "v1", "FaceTime HD Camera"), d("audiooutput", "o1", "AirPods Pro")];
  const dev = (id: string, label = "") => ({ id, label });

  it("requires each remembered device exactly, so the browser can't swap in the default", () => {
    expect(rememberedDevices({ audioinput: dev("a2"), videoinput: dev("v1"), audiooutput: dev("o1") }, plugged)).toEqual({
      audioCaptureDefaults: { deviceId: { exact: "a2" } },
      videoCaptureDefaults: { deviceId: { exact: "v1" } },
      audioOutput: { deviceId: "o1" },
    });
  });

  it("leaves out a device that is no longer plugged in, so the huddle starts on the default", () => {
    expect(rememberedDevices({ audioinput: dev("usb-mic", "Yeti Stereo Microphone"), videoinput: dev("v1") }, plugged)).toEqual({
      videoCaptureDefaults: { deviceId: { exact: "v1" } },
    });
  });

  it("follows a device whose id changed, and handles nothing remembered", () => {
    expect(rememberedDevices({ audioinput: dev("gone", "AirPods Pro") }, plugged)).toEqual({ audioCaptureDefaults: { deviceId: { exact: "a2" } } });
    expect(rememberedDevices({}, plugged)).toEqual({});
  });
});
