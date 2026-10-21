import assert from "node:assert/strict";
import { describe, test } from "node:test";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import {
  checkSvgSource,
  prepareSvg,
  svgDataUri,
  isWellFormedSvg,
} from "../../public/js/domain/svg.js";

// jsdom provides the DOM that DOMPurify and DOMParser need outside the browser.
const { window } = new JSDOM("");
const purifier = createDOMPurify(window);
const parser = new window.DOMParser();
const run = (text) => prepareSvg(text, { purifier, parser });

const NS = 'xmlns="http://www.w3.org/2000/svg"';

describe("checkSvgSource", () => {
  test("rejects empty input", () => {
    assert.equal(checkSvgSource("   ").error.key, "errors.svg.empty");
  });

  test("rejects text that is not an SVG document", () => {
    assert.equal(checkSvgSource("<div>hi</div>").error.key, "errors.svg.notSvg");
  });

  test("skips an XML declaration and comments before the root element", () => {
    const source = `<?xml version="1.0"?><!-- made in a tool --><svg ${NS}></svg>`;
    const result = checkSvgSource(source);
    assert.equal(result.ok, true);
    assert.ok(result.source.startsWith("<svg"));
  });

  test("accepts exactly 100 KB", () => {
    const head = `<svg ${NS}><desc>`;
    const tail = "</desc></svg>";
    const exact = head + "a".repeat(100000 - head.length - tail.length) + tail;
    assert.equal(checkSvgSource(exact).ok, true);
  });

  test("rejects one byte over 100 KB", () => {
    const head = `<svg ${NS}><desc>`;
    const tail = "</desc></svg>";
    const over = head + "a".repeat(100001 - head.length - tail.length) + tail;
    assert.equal(checkSvgSource(over).error.key, "errors.svg.tooLarge");
  });
});

describe("prepareSvg", () => {
  test("keeps a plain icon", () => {
    const result = run(
      `<svg ${NS} viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>`,
    );
    assert.equal(result.ok, true);
    assert.match(result.svg, /<rect/);
  });

  test("removes script elements", () => {
    const result = run(`<svg ${NS}><script>alert(1)</script><rect width="1" height="1"/></svg>`);
    assert.equal(result.ok, true);
    assert.doesNotMatch(result.svg, /script/i);
    assert.doesNotMatch(result.svg, /alert/);
  });

  test("removes event handler attributes", () => {
    const result = run(`<svg ${NS}><rect width="1" height="1" onload="alert(1)"/></svg>`);
    assert.doesNotMatch(result.svg, /onload/i);
  });

  test("removes foreignObject, which can embed HTML", () => {
    const result = run(`<svg ${NS}><foreignObject><div>x</div></foreignObject></svg>`);
    assert.doesNotMatch(result.svg, /foreignObject/i);
  });

  test("removes external use references", () => {
    const result = run(`<svg ${NS}><use href="https://evil.example/x.svg#a"/></svg>`);
    assert.doesNotMatch(result.svg, /<use/);
    assert.doesNotMatch(result.svg, /evil\.example/);
  });

  test("removes javascript: links", () => {
    const result = run(
      `<svg ${NS}><a href="javascript:alert(1)"><rect width="1" height="1"/></a></svg>`,
    );
    assert.doesNotMatch(result.svg, /javascript:/i);
  });

  test("reports a non-SVG error and does not call the parser for it", () => {
    const result = run("<p>not an icon</p>");
    assert.equal(result.ok, false);
    assert.equal(result.error.key, "errors.svg.notSvg");
  });
});

describe("isWellFormedSvg", () => {
  test("accepts a parsed SVG root", () => {
    assert.equal(isWellFormedSvg(`<svg ${NS}></svg>`, parser), true);
  });

  test("rejects markup that does not start with svg", () => {
    assert.equal(isWellFormedSvg("<rect/>", parser), false);
  });
});

describe("svgDataUri", () => {
  test("encodes markup as an image data URI", () => {
    const uri = svgDataUri(`<svg ${NS}></svg>`);
    assert.ok(uri.startsWith("data:image/svg+xml;charset=utf-8,"));
    assert.ok(!uri.includes("<svg"));
  });
});
