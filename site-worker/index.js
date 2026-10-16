// Video seeking for the website's MP4/WebM files (episodes + feature clips).
// Cloudflare's static-asset hosting always answers with the whole file, even when the browser asks for only part of
// it ("Range: bytes=…"). Without that, a video can't be skipped ahead (Chrome jumps back to the start) and Safari /
// iPhone may not play it at all. This answers range requests with "206 Partial Content", streaming just the bytes
// asked for. Everything else is served by the static assets exactly as before.

const VIDEO = /\.(mp4|webm|m4v|mov)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!VIDEO.test(url.pathname) || (request.method !== "GET" && request.method !== "HEAD")) {
      return env.ASSETS.fetch(request);
    }
    // The whole file from the static assets (no Range header — they ignore it anyway).
    const plain = new Request(request.url, { method: "GET", headers: { "Accept-Encoding": "identity" } });
    const res = await env.ASSETS.fetch(plain);
    if (res.status !== 200 || !res.body) { return res; }
    // The file's size: from Content-Length when the assets give it; otherwise read the file (our videos are ≤ ~25 MB).
    let size = Number(res.headers.get("Content-Length") || NaN), whole = null;
    if (!Number.isFinite(size) || size <= 0) { whole = new Uint8Array(await res.arrayBuffer()); size = whole.byteLength; }
    const body = () => (whole ? whole : res.body);
    const headers = new Headers(res.headers);
    headers.set("Accept-Ranges", "bytes"); // tells the browser it may ask for parts (needed to allow seeking)
    headers.delete("Content-Encoding");

    const range = request.headers.get("Range");
    headers.set("Content-Length", String(size));
    const done = () => { if (!whole) { res.body.cancel(); } };
    if (!range) {
      if (request.method === "HEAD") { done(); return new Response(null, { status: 200, headers }); }
      return new Response(body(), { status: 200, headers });
    }

    // One range: "bytes=START-END", "bytes=START-" or "bytes=-SUFFIX". (Several ranges at once → the whole file.)
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!m || (m[1] === "" && m[2] === "")) { return new Response(body(), { status: 200, headers }); }
    let start, end;
    if (m[1] === "") { const n = Number(m[2]); start = Math.max(0, size - n); end = size - 1; }
    else { start = Number(m[1]); end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1); }
    if (start >= size || start > end) {
      done();
      headers.set("Content-Range", `bytes */${size}`);
      headers.delete("Content-Length");
      return new Response(null, { status: 416, headers });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    if (request.method === "HEAD") { done(); return new Response(null, { status: 206, headers }); }
    return new Response(whole ? whole.slice(start, end + 1) : slice(res.body, start, end), { status: 206, headers });
  },
};

/** Stream only bytes [start, end] (inclusive) of a body. */
function slice(body, start, end) {
  let pos = 0;
  const reader = body.getReader();
  return new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { controller.close(); return; }
        const from = pos, to = pos + value.byteLength; // this chunk covers [from, to)
        pos = to;
        if (to <= start) { continue; } // before the range — skip
        const a = Math.max(start, from) - from, b = Math.min(end + 1, to) - from;
        if (b > a) { controller.enqueue(value.subarray(a, b)); }
        if (to > end) { await reader.cancel(); controller.close(); }
        return;
      }
    },
    cancel(reason) { return reader.cancel(reason); },
  });
}
