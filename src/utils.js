/**
 * Tiny ANSI color helpers — CommonJS uyumlu, chalk alternatifi.
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
};
