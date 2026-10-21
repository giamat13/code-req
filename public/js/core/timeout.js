// Firestore keeps a read pending while the backend cannot be reached, so a page that waits on one needs its own limit.
// The pending read is not cancelled. The page simply stops waiting and shows its network error.
export function withTimeout(promise, ms = 15000) {
  let timer = null;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}
