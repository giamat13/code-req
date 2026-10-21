import { $ } from "../core/dom.js";
import { isConfigured } from "../core/config.js";
import { describeError } from "../core/errors.js";
import { t } from "../core/i18n.js";
import { startPage } from "../core/page.js";
import { getParam } from "../core/router.js";
import { markSeen } from "../core/seen.js";
import { statusBadge } from "../components/ui.js";
import { mountRequestDetail } from "../components/requestDetail.js";
import { isDeveloperAccount, watchSignIn } from "../services/auth.js";
import { getPrivateNotes, watchRequest } from "../services/requests.js";

// A request that takes longer than this to arrive is shown as a connection problem, not left spinning.
const LOAD_TIMEOUT_MS = 15000;
const SECTIONS = [
  "request-loading",
  "request-gate",
  "request-missing",
  "request-error",
  "request-page",
];

const state = {
  uid: null,
  detail: null,
  stopWatch: null,
  loaded: false,
  timer: null,
};

function show(section) {
  for (const id of SECTIONS) $(`#${id}`).hidden = id !== section;
}

function stopCurrent() {
  clearTimeout(state.timer);
  state.stopWatch?.();
  state.stopWatch = null;
  state.detail?.stop();
  state.detail = null;
  state.loaded = false;
}

function showMissing() {
  stopCurrent();
  show("request-missing");
}

function showError(error) {
  stopCurrent();
  $("#request-error-body").textContent = describeError(error);
  show("request-error");
}

async function loadNotes(id) {
  try {
    const data = await getPrivateNotes(id);
    return { internalNotes: data?.internalNotes ?? "", tags: data?.tags ?? [] };
  } catch {
    return { internalNotes: "", tags: [] };
  }
}

// Shows one request. Live changes update the heading, the badge, and the controls in place.
async function open(user) {
  const id = getParam("r");
  if (!id) {
    showMissing();
    return;
  }
  show("request-loading");
  const notes = await loadNotes(id);
  state.timer = setTimeout(() => {
    if (!state.loaded) showError(new Error("timed out"));
  }, LOAD_TIMEOUT_MS);

  state.stopWatch = watchRequest(
    id,
    (request) => {
      if (!request || request.developerUid !== user.uid) {
        showMissing();
        return;
      }
      state.loaded = true;
      clearTimeout(state.timer);
      // The developer is looking at this request, so it counts as seen as changes arrive.
      markSeen(id);
      $("#request-title").textContent = request.title;
      $("#request-status-badge").replaceChildren(statusBadge(request.status));
      show("request-page");
      if (state.detail) {
        state.detail.update(request);
      } else {
        state.detail = mountRequestDetail($("#request-detail"), request, {
          notes,
          onDeleted: () => window.location.assign("dashboard.html"),
        });
      }
    },
    (error) => {
      // A read the rules deny means this request belongs to someone else, so it is treated as missing.
      if (error.code === "permission-denied") showMissing();
      else showError(error);
    },
  );
}

function wireAuth() {
  watchSignIn((user) => {
    if (!user || !isDeveloperAccount(user)) {
      stopCurrent();
      state.uid = null;
      show("request-gate");
      return;
    }
    if (state.uid === user.uid) return;
    state.uid = user.uid;
    open(user);
  });
}

startPage(() => {
  $("#request-retry").addEventListener("click", () => window.location.reload());
  if (!isConfigured) {
    show("request-gate");
    $("#request-gate-body").textContent = t("setup.notConfigured");
    return;
  }
  wireAuth();
});
