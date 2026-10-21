import { h } from "../core/dom.js";
import { t } from "../core/i18n.js";

let counter = 0;
const nextId = (name) => {
  counter += 1;
  return `${name}-${counter}`;
};

export function errorText(error) {
  if (!error) return "";
  return t(error.key, error.params ?? {});
}

// Shared error and help handling. Errors are linked to the control with aria-describedby, and they
// are announced politely when they appear.
function decorate({ id, control, help, errorNode, helpId }) {
  return {
    setError(error) {
      const message = errorText(error);
      errorNode.textContent = message;
      errorNode.hidden = !message;
      control.setAttribute("aria-invalid", message ? "true" : "false");
      const describedBy = [helpId, message ? errorNode.id : null].filter(Boolean).join(" ");
      if (describedBy) control.setAttribute("aria-describedby", describedBy);
      else control.removeAttribute("aria-describedby");
    },
    id,
  };
}

function errorNodeFor(id) {
  return h("p", { class: "field-error", id: `${id}-error`, hidden: true, "aria-live": "polite" });
}

function helpNodeFor(id, help) {
  return help ? h("p", { class: "field-help", id: `${id}-help` }, help) : null;
}

function requiredMark(required) {
  return required ? h("span", { class: "field-required", "aria-hidden": "true" }, " *") : null;
}

export function textField({
  name,
  label,
  value = "",
  type = "text",
  required = false,
  help = null,
  multiline = false,
  rows = 4,
  max = null,
  placeholder = null,
  autocomplete = null,
  inputmode = null,
  min = null,
}) {
  const id = nextId(name);
  const control = multiline
    ? h("textarea", { name, rows, required, placeholder, autocomplete, value })
    : h("input", { type, name, value, required, placeholder, autocomplete, inputmode, min });
  const counterNode = max ? h("span", { class: "field-counter" }) : null;
  const updateCounter = () => {
    if (counterNode) counterNode.textContent = `${[...control.value].length} / ${max}`;
  };
  control.addEventListener("input", updateCounter);
  updateCounter();

  const helpNode = helpNodeFor(id, help);
  const errorNode = errorNodeFor(id);
  control.id = id;
  if (helpNode) control.setAttribute("aria-describedby", helpNode.id);
  const root = h(
    "div",
    { class: "field", dataset: { field: name } },
    h(
      "div",
      { class: "field-head" },
      h("label", { class: "field-label", for: id }, label, requiredMark(required)),
      counterNode,
    ),
    control,
    helpNode,
    errorNode,
  );
  return {
    root,
    control,
    ...decorate({ id, control, help, errorNode, helpId: helpNode?.id ?? null }),
    read: () => control.value,
    write: (next) => {
      control.value = next ?? "";
      updateCounter();
    },
  };
}

export function selectField({ name, label, options, value = "", required = false, help = null }) {
  const id = nextId(name);
  const control = h(
    "select",
    { name, required },
    options.map((option) =>
      h("option", { value: option.value, selected: option.value === value }, option.label),
    ),
  );
  const helpNode = helpNodeFor(id, help);
  const errorNode = errorNodeFor(id);
  control.id = id;
  const root = h(
    "div",
    { class: "field", dataset: { field: name } },
    h("label", { class: "field-label", for: id }, label, requiredMark(required)),
    control,
    helpNode,
    errorNode,
  );
  return {
    root,
    control,
    ...decorate({ id, control, help, errorNode, helpId: helpNode?.id ?? null }),
    read: () => control.value,
    write: (next) => {
      control.value = next ?? "";
    },
  };
}

// A group of options drawn as pills (checkboxes). Used for platforms.
export function pillField({ name, label, options, selected = [], required = false, help = null }) {
  const id = nextId(name);
  const boxes = options.map((option) =>
    h("input", {
      type: "checkbox",
      name,
      value: option.value,
      checked: selected.includes(option.value),
    }),
  );
  const helpNode = helpNodeFor(id, help);
  const errorNode = errorNodeFor(id);
  const group = h(
    "div",
    {
      class: "pill-group",
      role: "group",
      "aria-labelledby": `${id}-label`,
      "aria-describedby": helpNode?.id,
    },
    options.map((option, index) =>
      h("label", { class: "pill" }, boxes[index], h("span", {}, option.label)),
    ),
  );
  const root = h(
    "fieldset",
    { class: "field field-group", dataset: { field: name } },
    h("legend", { class: "field-label", id: `${id}-label` }, label, requiredMark(required)),
    group,
    helpNode,
    errorNode,
  );
  const setError = (error) => {
    const message = errorText(error);
    errorNode.textContent = message;
    errorNode.hidden = !message;
    group.setAttribute("aria-invalid", message ? "true" : "false");
  };
  return {
    root,
    control: group,
    id,
    setError,
    focus: () => boxes[0]?.focus(),
    read: () => boxes.filter((box) => box.checked).map((box) => box.value),
    write: (values) => {
      for (const box of boxes) box.checked = values.includes(box.value);
    },
  };
}

// Radio buttons for a single choice.
export function radioField({ name, label, options, value = "", help = null }) {
  const id = nextId(name);
  const radios = options.map((option) =>
    h("input", { type: "radio", name, value: option.value, checked: option.value === value }),
  );
  const helpNode = helpNodeFor(id, help);
  const errorNode = errorNodeFor(id);
  const root = h(
    "fieldset",
    { class: "field field-group", dataset: { field: name } },
    h("legend", { class: "field-label" }, label),
    h(
      "div",
      { class: "radio-group" },
      options.map((option, index) =>
        h("label", { class: "radio" }, radios[index], h("span", {}, option.label)),
      ),
    ),
    helpNode,
    errorNode,
  );
  return {
    root,
    id,
    setError: (error) => {
      const message = errorText(error);
      errorNode.textContent = message;
      errorNode.hidden = !message;
    },
    focus: () => radios[0]?.focus(),
    read: () => radios.find((radio) => radio.checked)?.value ?? "",
    write: (next) => {
      for (const radio of radios) radio.checked = radio.value === next;
    },
  };
}

export function checkboxField({ name, label, checked = false, help = null, required = false }) {
  const id = nextId(name);
  const control = h("input", { type: "checkbox", name, checked, required });
  control.id = id;
  const helpNode = helpNodeFor(id, help);
  const errorNode = errorNodeFor(id);
  const root = h(
    "div",
    { class: "field field-check", dataset: { field: name } },
    h("label", { class: "check" }, control, h("span", {}, label, requiredMark(required))),
    helpNode,
    errorNode,
  );
  return {
    root,
    control,
    ...decorate({ id, control, help, errorNode, helpId: helpNode?.id ?? null }),
    read: () => control.checked,
    write: (next) => {
      control.checked = Boolean(next);
    },
  };
}
