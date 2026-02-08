export interface KeyPress {
  /** Key name. For paste events, name is "paste". */
  name: string;
  /** Raw key data. Usually one character, but for paste events may contain multiple characters including newlines. */
  raw: string;
}

export function readKey(): Promise<KeyPress> {
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    // Enable bracketed paste mode so terminals wrap pasted text in delimiters
    process.stdout.write("\x1b[?2004h");

    const done = (key: KeyPress) => {
      // Disable bracketed paste mode
      process.stdout.write("\x1b[?2004l");
      resolve(key);
    };

    const onData = (data: string) => {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);

      // Bracketed paste: \x1b[200~ ... \x1b[201~
      if (data.startsWith("\x1b[200~")) {
        const endMarker = "\x1b[201~";
        const endIdx = data.indexOf(endMarker);
        const content = (endIdx >= 0 ? data.slice(6, endIdx) : data.slice(6))
          .replace(/\r\n/g, "\n")
          .replace(/\r/g, "\n");
        done({ name: "paste", raw: content });
      } else if (data === "\x03") {
        done({ name: "escape", raw: data }); // Ctrl+C → escape
      } else if (data === "\x1b" || data === "\x1b\x1b") {
        done({ name: "escape", raw: data });
      } else if (data === "\x1b[A") {
        done({ name: "up", raw: data });
      } else if (data === "\x1b[B") {
        done({ name: "down", raw: data });
      } else if (data === "\x1b[C") {
        done({ name: "right", raw: data });
      } else if (data === "\x1b[D") {
        done({ name: "left", raw: data });
      } else if (data === "\x1b[1;5C" || data === "\x1b[5C") {
        done({ name: "ctrl-right", raw: data });
      } else if (data === "\x1b[1;5D" || data === "\x1b[5D") {
        done({ name: "ctrl-left", raw: data });
      } else if (data === "\x1b[3~") {
        done({ name: "delete", raw: data });
      } else if (data === "\x1b[H" || data === "\x1b[1~") {
        done({ name: "home", raw: data });
      } else if (data === "\x1b[F" || data === "\x1b[4~") {
        done({ name: "end", raw: data });
      } else if (data === "\x01") {
        done({ name: "home", raw: data }); // Ctrl+A
      } else if (data === "\x05") {
        done({ name: "end", raw: data }); // Ctrl+E
      } else if (data === "\r" || data === "\n") {
        done({ name: "enter", raw: data });
      } else if (data === "\x7f" || data === "\x08") {
        done({ name: "backspace", raw: data });
      } else if (data === "\t") {
        done({ name: "tab", raw: data });
      } else if (data === "\x13") {
        done({ name: "ctrl-s", raw: data }); // Ctrl+S
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        done({ name: data, raw: data });
      } else if (data.length > 1 && !data.startsWith("\x1b")) {
        // Non-bracketed paste fallback: multi-char printable data
        const filtered = [...data.replace(/\r\n/g, "\n").replace(/\r/g, "\n")]
          .filter((c) => c.charCodeAt(0) >= 32 || c === "\n")
          .join("");
        if (filtered.length > 0) {
          done({ name: "paste", raw: filtered });
        } else {
          stdin.setRawMode(true);
          stdin.resume();
          stdin.on("data", onData);
        }
      } else {
        // Unknown sequence — treat as no-op, read again
        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("data", onData);
      }
    };

    stdin.on("data", onData);
  });
}
