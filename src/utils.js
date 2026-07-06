/**
 * Tiny ANSI color helpers — zero-dependency chalk alternative.
 * CommonJS compatible.
 */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function color(name) {
  const c = colors[name] || "";
  return (text) => `${c}${text}${colors.reset}`;
}

/** Simple spinner frames for CLI progress */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * Create a spinner that runs during an async operation.
 * @param {string} message - Initial spinner message
 * @returns {{ update: (msg: string) => void, stop: (finalMsg?: string) => void }}
 */
function spinner(message) {
  let i = 0;
  let currentMsg = message;
  const interval = setInterval(() => {
    process.stderr.write(`\r${SPINNER_FRAMES[i % SPINNER_FRAMES.length]} ${currentMsg}`);
    i++;
  }, 80);
  return {
    update(msg) {
      currentMsg = msg;
    },
    stop(finalMsg) {
      clearInterval(interval);
      if (finalMsg) {
        process.stderr.write(`\r${finalMsg}\n`);
      } else {
        process.stderr.write(`\r${" ".repeat(currentMsg.length + 2)}\r`);
      }
    },
  };
}

module.exports = {
  chalk: {
    red: color("red"),
    green: color("green"),
    yellow: color("yellow"),
    blue: color("blue"),
    cyan: color("cyan"),
    gray: color("gray"),
    bold: color("bold"),
  },
  spinner,
};
