import DOMPurify from "../../vendor/dompurify/purify.es.mjs";
import { h } from "../core/dom.js";
import { t } from "../core/i18n.js";
import { icon } from "../core/icons.js";
import { LIMITS, TEMPLATES } from "../domain/constants.js";
import { prepareSvg, svgDataUri } from "../domain/svg.js";
import { todayIso } from "../domain/time.js";
import { errorText, pillField, selectField, textField } from "./forms.js";
import { platformLabel } from "./ui.js";

// Fields a requester fills in for a request. Used by the public form and by the tracking page editor.
// Order matters: setErrors and focusFirstError follow it.
const FIELD_ORDER = [
  "requesterName",
  "title",
  "appName",
  "appDescription",
  "svgIcon",
  "platforms",
  "notes",
  "template",
  "budgetMin",
  "budgetMax",
  "deadline",
];

const SVG_DEBOUNCE_MS = 300;

function svgField(initialSvg) {
  let svgMarkup = initialSvg ?? null;
  let svgError = null;
  let timer = null;

  const fileInput = h("input", {
    type: "file",
    accept: ".svg,image/svg+xml",
    class: "svg-file",
    "aria-describedby": "svg-help",
  });
  const textarea = h("textarea", {
    rows: 4,
    spellcheck: "false",
    class: "svg-code",
    placeholder: '<svg xmlns="http://www.w3.org/2000/svg" …>',
    "aria-label": t("form.svgPaste"),
    value: svgMarkup ?? "",
  });
  const preview = h("img", {
    class: "svg-preview",
    alt: t("form.svgPreviewAlt"),
    hidden: !svgMarkup,
  });
  if (svgMarkup) preview.src = svgDataUri(svgMarkup);
  const removeButton = h(
    "button",
    { type: "button", class: "btn btn-ghost btn-sm", hidden: !svgMarkup, onclick: () => clear() },
    icon("x", { size: 16 }),
    t("form.svgRemove"),
  );
  const errorNode = h("p", {
    class: "field-error",
    hidden: true,
    "aria-live": "polite",
    id: "svg-error",
  });

  function apply(source) {
    if (source.trim() === "") {
      svgMarkup = null;
      svgError = null;
    } else {
      const result = prepareSvg(source, { purifier: DOMPurify, parser: new DOMParser() });
      svgMarkup = result.ok ? result.svg : null;
      svgError = result.ok ? null : result.error;
    }
    preview.hidden = !svgMarkup;
    removeButton.hidden = !svgMarkup;
    if (svgMarkup) preview.src = svgDataUri(svgMarkup);
    else preview.removeAttribute("src");
    const message = errorText(svgError);
    errorNode.textContent = message;
    errorNode.hidden = !message;
    textarea.setAttribute("aria-invalid", message ? "true" : "false");
  }

  function clear() {
    textarea.value = "";
    fileInput.value = "";
    apply("");
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > LIMITS.svgBytes) {
      svgError = { key: "errors.svg.tooLarge", params: { kb: LIMITS.svgBytes / 1000 } };
      svgMarkup = null;
      errorNode.textContent = errorText(svgError);
      errorNode.hidden = false;
      return;
    }
    textarea.value = await file.text();
    apply(textarea.value);
  });

  textarea.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => apply(textarea.value), SVG_DEBOUNCE_MS);
  });
  removeButton.addEventListener("click", clear);
  if (svgMarkup) apply(svgMarkup);

  const root = h(
    "div",
    { class: "field", dataset: { field: "svgIcon" } },
    h("p", { class: "field-label" }, t("form.svgLabel")),
    h("p", { class: "field-help", id: "svg-help" }, t("form.svgHelp")),
    h("div", { class: "svg-inputs" }, fileInput, textarea),
    h("div", { class: "svg-result" }, preview, removeButton),
    errorNode,
  );

  return {
    root,
    // Applies pending text first, so the value is current even before the debounce fires.
    read() {
      clearTimeout(timer);
      apply(textarea.value);
      return { svgIcon: svgMarkup, error: svgError };
    },
    write(markup) {
      textarea.value = markup ?? "";
      apply(textarea.value);
    },
    setError(error) {
      svgError = error;
      const message = errorText(error);
      errorNode.textContent = message;
      errorNode.hidden = !message;
    },
    focus: () => textarea.focus(),
  };
}

export function createRequestFields({ acceptedPlatforms, initial = {} }) {
  const fields = {
    requesterName: textField({
      name: "requesterName",
      label: t("form.requesterName"),
      value: initial.requesterName ?? "",
      required: true,
      max: LIMITS.requesterName.max,
      autocomplete: "name",
      help: t("form.requesterNameHelp"),
    }),
    title: textField({
      name: "title",
      label: t("form.title"),
      value: initial.title ?? "",
      required: true,
      max: LIMITS.title.max,
      help: t("form.titleHelp"),
    }),
    appName: textField({
      name: "appName",
      label: t("form.appName"),
      value: initial.appName ?? "",
      required: true,
      max: LIMITS.appName.max,
    }),
    appDescription: textField({
      name: "appDescription",
      label: t("form.appDescription"),
      value: initial.appDescription ?? "",
      required: true,
      multiline: true,
      rows: 6,
      max: LIMITS.appDescription.max,
      help: t("form.appDescriptionHelp"),
    }),
    svgIcon: svgField(initial.svgIcon),
    platforms: pillField({
      name: "platforms",
      label: t("form.platforms"),
      options: acceptedPlatforms.map((platform) => ({
        value: platform,
        label: platformLabel(platform),
      })),
      selected: initial.platforms ?? [],
      required: true,
      help: t("form.platformsHelp"),
    }),
    notes: textField({
      name: "notes",
      label: t("form.notes"),
      value: initial.notes ?? "",
      multiline: true,
      rows: 4,
      max: LIMITS.notes.max,
    }),
    template: selectField({
      name: "template",
      label: t("form.template"),
      value: initial.template ?? "",
      options: [
        { value: "", label: t("template.none") },
        ...TEMPLATES.map((item) => ({ value: item, label: t(`template.${item}`) })),
      ],
      help: t("form.templateHelp"),
    }),
    budgetMin: textField({
      name: "budgetMin",
      label: t("form.budgetMin"),
      value: initial.budgetMin ?? "",
      type: "number",
      inputmode: "numeric",
      min: 0,
      help: t("form.budgetHelp"),
    }),
    budgetMax: textField({
      name: "budgetMax",
      label: t("form.budgetMax"),
      value: initial.budgetMax ?? "",
      type: "number",
      inputmode: "numeric",
      min: 0,
      help: t("form.budgetHelp"),
    }),
    deadline: textField({
      name: "deadline",
      label: t("form.deadline"),
      value: initial.deadline ?? "",
      type: "date",
      min: todayIso(),
      help: t("form.deadlineHelp"),
    }),
  };

  // Starter text fills an empty description only. It never overwrites what the requester wrote.
  fields.template.control.addEventListener("change", () => {
    const starter = fields.template.read();
    if (starter && fields.appDescription.read().trim() === "") {
      fields.appDescription.write(t(`template.starter.${starter}`));
    }
  });

  const root = h(
    "div",
    { class: "request-fields" },
    h("div", { class: "field-row" }, fields.requesterName.root, fields.title.root),
    h("div", { class: "field-row" }, fields.appName.root, fields.template.root),
    fields.appDescription.root,
    fields.platforms.root,
    fields.svgIcon.root,
    fields.notes.root,
    h(
      "div",
      { class: "field-row" },
      fields.budgetMin.root,
      fields.budgetMax.root,
      fields.deadline.root,
    ),
  );

  return {
    root,
    // Returns the raw values for validateRequestForm, plus any SVG error the field found.
    read() {
      const svg = fields.svgIcon.read();
      return {
        input: {
          requesterName: fields.requesterName.read(),
          title: fields.title.read(),
          appName: fields.appName.read(),
          appDescription: fields.appDescription.read(),
          svgIcon: svg.svgIcon,
          platforms: fields.platforms.read(),
          notes: fields.notes.read(),
          template: fields.template.read(),
          budgetMin: fields.budgetMin.read(),
          budgetMax: fields.budgetMax.read(),
          deadline: fields.deadline.read(),
        },
        svgError: svg.error,
      };
    },
    setErrors(errors, svgError = null) {
      for (const name of FIELD_ORDER) {
        if (name === "svgIcon") fields.svgIcon.setError(svgError ?? errors.svgIcon ?? null);
        else fields[name].setError(errors[name] ?? null);
      }
    },
    focusFirstError(errors, svgError = null) {
      const first = FIELD_ORDER.find((name) => (name === "svgIcon" ? svgError : errors[name]));
      if (!first) return;
      if (first === "svgIcon") fields.svgIcon.focus();
      else if (first === "platforms") fields.platforms.focus();
      else fields[first].control.focus();
    },
    fields,
  };
}
