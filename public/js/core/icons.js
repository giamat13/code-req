import { svg } from "./dom.js";

// Stroke icons on a 24 px grid. Each entry lists the SVG elements that make up the icon.
const ICONS = {
  alert: [
    ["path", { d: "M12 3.5L21.5 20h-19z" }],
    ["path", { d: "M12 10v4.5M12 17.2v.3" }],
  ],
  board: [
    ["rect", { x: 3.5, y: 4, width: 5, height: 16, rx: 1 }],
    ["rect", { x: 9.5, y: 4, width: 5, height: 10, rx: 1 }],
    ["rect", { x: 15.5, y: 4, width: 5, height: 13, rx: 1 }],
  ],
  bell: [
    ["path", { d: "M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" }],
    ["path", { d: "M10 21h4" }],
  ],
  check: [["path", { d: "M5 12.5l4.5 4.5L19 7.5" }]],
  chart: [["path", { d: "M4 20V10M10 20V4M16 20v-7M22 20H2" }]],
  clock: [
    ["circle", { cx: 12, cy: 12, r: 8.5 }],
    ["path", { d: "M12 7.5V12l3 2" }],
  ],
  copy: [
    ["rect", { x: 9, y: 9, width: 11, height: 11, rx: 2 }],
    ["path", { d: "M5 15V6a2 2 0 0 1 2-2h9" }],
  ],
  download: [["path", { d: "M12 4v11M7 10l5 5 5-5M4 20h16" }]],
  edit: [["path", { d: "M4 20h4L19 9l-4-4L4 16z" }]],
  external: [
    ["path", { d: "M14 4h6v6M20 4l-9 9" }],
    ["path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }],
  ],
  folder: [
    ["path", { d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
  ],
  inbox: [
    ["path", { d: "M3 13l3-8h12l3 8v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" }],
    ["path", { d: "M3 13h5l1 2h6l1-2h5" }],
  ],
  link: [
    ["path", { d: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" }],
    ["path", { d: "M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" }],
  ],
  logout: [
    ["path", { d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" }],
    ["path", { d: "M10 17l-5-5 5-5M5 12h11" }],
  ],
  mail: [
    ["rect", { x: 3, y: 5, width: 18, height: 14, rx: 2 }],
    ["path", { d: "M3 7l9 6 9-6" }],
  ],
  menu: [["path", { d: "M4 7h16M4 12h16M4 17h16" }]],
  message: [["path", { d: "M4 5h16v11H9l-5 4z" }]],
  monitor: [
    ["rect", { x: 3, y: 4, width: 18, height: 12, rx: 2 }],
    ["path", { d: "M8 20h8M12 16v4" }],
  ],
  moon: [["path", { d: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" }]],
  phone: [
    [
      "path",
      {
        d: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
      },
    ],
  ],
  plus: [["path", { d: "M12 5v14M5 12h14" }]],
  portfolio: [
    ["rect", { x: 3, y: 7, width: 18, height: 13, rx: 2 }],
    ["path", { d: "M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" }],
  ],
  search: [
    ["circle", { cx: 11, cy: 11, r: 6.5 }],
    ["path", { d: "M16 16l4.5 4.5" }],
  ],
  settings: [
    ["circle", { cx: 12, cy: 12, r: 3 }],
    [
      "path",
      {
        d: "M12 2.5v2.5M12 19v2.5M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M2.5 12H5M19 12h2.5M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8",
      },
    ],
  ],
  shield: [["path", { d: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" }]],
  sun: [
    ["circle", { cx: 12, cy: 12, r: 4 }],
    [
      "path",
      {
        d: "M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4",
      },
    ],
  ],
  trash: [["path", { d: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" }]],
  users: [
    ["circle", { cx: 9, cy: 8, r: 3.5 }],
    ["path", { d: "M2.5 20a6.5 6.5 0 0 1 13 0" }],
    ["path", { d: "M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6" }],
  ],
  x: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
  arrowLeft: [["path", { d: "M19 12H5M11 6l-6 6 6 6" }]],
  arrowRight: [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
};

export function icon(name, { label = null, size = 20 } = {}) {
  const node = svg("svg", {
    class: "icon",
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.6,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    role: label ? "img" : null,
    "aria-label": label,
    "aria-hidden": label ? null : "true",
    focusable: "false",
  });
  for (const [tag, attributes] of ICONS[name] ?? ICONS.alert) {
    node.append(svg(tag, attributes));
  }
  return node;
}
