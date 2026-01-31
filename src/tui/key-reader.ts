export interface KeyPress {
  name: string;
  raw: string;
}

export function readKey(): Promise<KeyPress> {
  return new Promise((resolve) => {
    const { stdin } = process;
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const onData = (data: string) => {
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdin.removeListener("data", onData);

      if (data === "\x03") {
        resolve({ name: "escape", raw: data }); // Ctrl+C → escape
      } else if (data === "\x1b" || data === "\x1b\x1b") {
        resolve({ name: "escape", raw: data });
      } else if (data === "\x1b[A") {
        resolve({ name: "up", raw: data });
      } else if (data === "\x1b[B") {
        resolve({ name: "down", raw: data });
      } else if (data === "\x1b[C") {
        resolve({ name: "right", raw: data });
      } else if (data === "\x1b[D") {
        resolve({ name: "left", raw: data });
      } else if (data === "\x1b[1;5C" || data === "\x1b[5C") {
        resolve({ name: "ctrl-right", raw: data });
      } else if (data === "\x1b[1;5D" || data === "\x1b[5D") {
        resolve({ name: "ctrl-left", raw: data });
      } else if (data === "\x1b[3~") {
        resolve({ name: "delete", raw: data });
      } else if (data === "\x1b[H" || data === "\x1b[1~") {
        resolve({ name: "home", raw: data });
      } else if (data === "\x1b[F" || data === "\x1b[4~") {
        resolve({ name: "end", raw: data });
      } else if (data === "\x01") {
        resolve({ name: "home", raw: data }); // Ctrl+A
      } else if (data === "\x05") {
        resolve({ name: "end", raw: data }); // Ctrl+E
      } else if (data === "\r" || data === "\n") {
        resolve({ name: "enter", raw: data });
      } else if (data === "\x7f" || data === "\x08") {
        resolve({ name: "backspace", raw: data });
      } else if (data === "\t") {
        resolve({ name: "tab", raw: data });
      } else if (data === "\x13") {
        resolve({ name: "ctrl-s", raw: data }); // Ctrl+S
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        resolve({ name: data, raw: data });
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
