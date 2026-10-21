// Pages are real files with query parameters, so the same build works on GitHub Pages and Firebase Hosting
// (see docs/decisions/0007-query-string-routes.md).

export function pageUrl(file, params = {}) {
  const url = new URL(file, location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  }
  return url.href;
}

export function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// Replaces the query string without adding a history entry.
export function replaceQuery(params) {
  const url = new URL(location.href);
  url.search = params.toString();
  history.replaceState(history.state, "", url);
}

export function developerUrl(username) {
  return pageUrl("developer.html", { u: username });
}

export function trackUrl(requestId) {
  return pageUrl("track.html", { r: requestId });
}
