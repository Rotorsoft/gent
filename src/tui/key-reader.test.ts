import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { readKey } from "./key-reader.js";

describe("readKey", () => {
  const realStdin = process.stdin;
  let mockStdin: EventEmitter & {
    isRaw: boolean;
    setRawMode: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setEncoding: ReturnType<typeof vi.fn>;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let writeSpy: any;

  beforeEach(() => {
    mockStdin = Object.assign(new EventEmitter(), {
      isRaw: false,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn(),
      setEncoding: vi.fn(),
    });
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      configurable: true,
      writable: true,
    });
    writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    Object.defineProperty(process, "stdin", {
      value: realStdin,
      configurable: true,
      writable: true,
    });
    writeSpy.mockRestore();
  });

  it("handles bracketed paste", async () => {
    const p = readKey();
    mockStdin.emit("data", "\x1b[200~hello world\x1b[201~");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "hello world" });
  });

  it("handles bracketed paste with newlines", async () => {
    const p = readKey();
    mockStdin.emit("data", "\x1b[200~line1\nline2\nline3\x1b[201~");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "line1\nline2\nline3" });
  });

  it("normalizes \\r\\n to \\n in bracketed paste", async () => {
    const p = readKey();
    mockStdin.emit("data", "\x1b[200~line1\r\nline2\x1b[201~");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "line1\nline2" });
  });

  it("handles bracketed paste without end marker", async () => {
    const p = readKey();
    mockStdin.emit("data", "\x1b[200~partial paste");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "partial paste" });
  });

  it("handles non-bracketed paste (multi-char data)", async () => {
    const p = readKey();
    mockStdin.emit("data", "hello world");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "hello world" });
  });

  it("filters non-printable characters from non-bracketed paste", async () => {
    const p = readKey();
    mockStdin.emit("data", "hello\x01world");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "helloworld" });
  });

  it("preserves newlines in non-bracketed paste", async () => {
    const p = readKey();
    mockStdin.emit("data", "line1\nline2");
    const key = await p;
    expect(key).toEqual({ name: "paste", raw: "line1\nline2" });
  });

  it("still handles single printable characters", async () => {
    const p = readKey();
    mockStdin.emit("data", "a");
    const key = await p;
    expect(key).toEqual({ name: "a", raw: "a" });
  });

  it("still handles escape sequences", async () => {
    const p = readKey();
    mockStdin.emit("data", "\x1b[A");
    const key = await p;
    expect(key).toEqual({ name: "up", raw: "\x1b[A" });
  });

  it("enables bracketed paste mode on entry", async () => {
    const p = readKey();
    mockStdin.emit("data", "a");
    await p;
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?2004h");
  });

  it("disables bracketed paste mode on resolve", async () => {
    const p = readKey();
    mockStdin.emit("data", "a");
    await p;
    expect(writeSpy).toHaveBeenCalledWith("\x1b[?2004l");
  });

  it("retries on unknown escape sequences", async () => {
    const p = readKey();
    // First emit an unknown escape sequence (should be retried)
    mockStdin.emit("data", "\x1b[?999h");
    // Then emit a real key
    mockStdin.emit("data", "x");
    const key = await p;
    expect(key).toEqual({ name: "x", raw: "x" });
  });
});
