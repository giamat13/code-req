import { h } from "../core/dom.js";
import { icon } from "../core/icons.js";
import { t } from "../core/i18n.js";
import { LIMITS, PLATFORMS } from "../domain/constants.js";
import { buildPlatformList, cleanPlatformName, customPlatformError } from "../domain/platforms.js";
import { errorText } from "./forms.js";
import { platformLabel } from "./ui.js";

let counter = 0;

// Built-in platforms as pills. "Other" needs a name: pick it, write what the platform is, and click Add.
// The name then becomes one of the developer's own platforms.
export function createPlatformPicker({ selected = PLATFORMS, custom = [] } = {}) {
  counter += 1;
  const groupId = `platforms-${counter}`;
  let customList = [...custom];

  const boxes = Object.fromEntries(
    PLATFORMS.map((value) => [
      value,
      h("input", { type: "checkbox", name: "platform", value, checked: selected.includes(value) }),
    ]),
  );

  const errorNode = h("p", { class: "field-error", hidden: true, "aria-live": "polite" });
  const helpNode = h(
    "p",
    { id: `${groupId}-help`, class: "field-help" },
    t("onboarding.customHelp"),
  );
  const chips = h("ul", {
    class: "chip-list custom-list",
    "aria-label": t("onboarding.customPlatforms"),
  });

  function setError(error) {
    const message = errorText(error);
    errorNode.textContent = message;
    errorNode.hidden = !message;
  }

  function renderChips() {
    chips.replaceChildren(
      ...customList.map((name) =>
        h(
          "li",
          { class: "chip chip-removable" },
          h("span", {}, name),
          h(
            "button",
            {
              type: "button",
              class: "chip-remove",
              "aria-label": t("onboarding.removePlatform", { name }),
              onclick: () => {
                customList = customList.filter((item) => item !== name);
                renderChips();
              },
            },
            icon("x", { size: 14 }),
          ),
        ),
      ),
    );
  }

  const nameInput = h("input", {
    type: "text",
    autocomplete: "off",
    maxlength: LIMITS.platformName.max,
    placeholder: t("onboarding.otherPlaceholder"),
    "aria-label": t("onboarding.otherName"),
  });
  const nameRow = h(
    "div",
    { class: "other-row", hidden: !boxes.other.checked },
    nameInput,
    h(
      "button",
      { type: "button", class: "btn btn-secondary btn-sm", onclick: addName },
      t("onboarding.addPlatform"),
    ),
  );

  function addName() {
    const name = cleanPlatformName(nameInput.value);
    const problem = customPlatformError(name, customList);
    if (problem) {
      setError(problem);
      nameInput.focus();
      return;
    }
    customList = [...customList, name];
    boxes.other.checked = false;
    nameRow.hidden = true;
    nameInput.value = "";
    setError(null);
    renderChips();
  }

  boxes.other.addEventListener("change", () => {
    nameRow.hidden = !boxes.other.checked;
    setError(null);
    if (boxes.other.checked) nameInput.focus();
  });

  const pills = h(
    "div",
    {
      class: "pill-group",
      role: "group",
      "aria-labelledby": `${groupId}-label`,
      "aria-describedby": helpNode.id,
    },
    PLATFORMS.map((value) =>
      h("label", { class: "pill" }, boxes[value], h("span", {}, platformLabel(value))),
    ),
  );

  renderChips();

  const root = h(
    "fieldset",
    { class: "field field-group", dataset: { field: "acceptedPlatforms" } },
    h(
      "legend",
      { class: "field-label", id: `${groupId}-label` },
      t("onboarding.platforms"),
      h("span", { class: "field-required", "aria-hidden": "true" }, " *"),
    ),
    pills,
    nameRow,
    chips,
    helpNode,
    errorNode,
  );

  // Returns the list to save, or an error when "Other" is picked but its name was not added yet.
  function read() {
    if (boxes.other.checked) return { list: null, error: { key: "onboarding.otherRequired" } };
    const builtIn = PLATFORMS.filter((value) => boxes[value].checked);
    return { list: buildPlatformList(builtIn, customList), error: null };
  }

  return {
    root,
    read,
    setError,
    focus: () => boxes[PLATFORMS[0]].focus(),
  };
}
