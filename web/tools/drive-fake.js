// In-memory fakes of the Drive REST v3 API and of Google Identity Services, for js/drive.mock-test.html and
// tools/capture-mock.html (the app with a fake Google Drive). No request leaves the browser.

// ------------------------------------------------------------------ fake Drive v3
export class FakeDrive {
  files = new Map();
  requests = [];
  failures = []; // [{ status, body, network, when?: (method, url) => bool }]
  seq = 0;
  token = null;

  add(f) {
    const t = new Date(Date.UTC(2026, 0, 1, 0, 0, ++this.seq)).toISOString();
    const file = { id: `f${this.seq}`, mimeType: "application/octet-stream", parents: [], appProperties: {}, content: new Uint8Array(),
      trashed: false, version: "1", createdTime: t, modifiedTime: t, ...f };
    this.files.set(file.id, file);
    return file;
  }
  pub(f) {
    const { content, trashed, ...rest } = f;
    return { ...rest, size: String(content.length), thumbnailLink: f.mimeType.startsWith("image/") ? `https://lh3.example/${f.id}` : undefined };
  }
  matches(f, q) {
    const unq = (s) => s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, "\\");
    const lit = "('(?:[^'\\\\]|\\\\.)*')";
    for (const m of q.matchAll(new RegExp(`name = ${lit}`, "g"))) if (f.name !== unq(m[1])) return false;
    for (const m of q.matchAll(new RegExp(`mimeType = ${lit}`, "g"))) if (f.mimeType !== unq(m[1])) return false;
    for (const m of q.matchAll(new RegExp(`mimeType != ${lit}`, "g"))) if (f.mimeType === unq(m[1])) return false;
    for (const m of q.matchAll(new RegExp(`${lit} in parents`, "g"))) if (!f.parents.includes(unq(m[1]))) return false;
    for (const m of q.matchAll(new RegExp(`appProperties has \\{ key=${lit} and value=${lit} \\}`, "g")))
      if (f.appProperties?.[unq(m[1])] !== unq(m[2])) return false;
    if (/trashed = false/.test(q) && f.trashed) return false;
    return true;
  }
  parentOk(parents) {
    return (parents || []).every((p) => p === "root" || (this.files.has(p) && !this.files.get(p).trashed));
  }
  byName(name) { return [...this.files.values()].filter((f) => f.name === name); }
  text(f) { return new TextDecoder().decode(f.content); }

  fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    this.requests.push({ method, url: url.toString() });
    const i = this.failures.findIndex((x) => !x.when || x.when(method, url));
    if (i >= 0) {
      const failure = this.failures.splice(i, 1)[0];
      if (failure.network) throw new TypeError("Failed to fetch");
      return Response.json(failure.body ?? {}, { status: failure.status });
    }
    if (init.headers?.Authorization !== `Bearer ${this.token}`) return Response.json({ error: { message: "Invalid Credentials" } }, { status: 401 });
    if (url.hostname !== "www.googleapis.com") throw new Error(`unexpected host ${url.hostname}`);
    const json = (b, status = 200) => Response.json(b, { status });
    const notFound = () => json({ error: { message: "File not found", errors: [{ reason: "notFound" }] } }, 404);
    const path = url.pathname;

    if (path === "/drive/v3/about") return json({ user: { emailAddress: "lab@example.org" } });
    if (path === "/drive/v3/files" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const found = [...this.files.values()].filter((f) => this.matches(f, q));
      const order = url.searchParams.get("orderBy") ?? "";
      found.sort((a, b) => (/modified/.test(order) ? a.modifiedTime.localeCompare(b.modifiedTime) : a.createdTime.localeCompare(b.createdTime)));
      if (/desc/.test(order)) found.reverse();
      const start = Number(url.searchParams.get("pageToken") ?? 0); // pages of 2 to exercise nextPageToken
      return json({ files: found.slice(start, start + 2).map((f) => this.pub(f)), nextPageToken: start + 2 < found.length ? String(start + 2) : undefined });
    }
    if (path === "/drive/v3/files" && method === "POST") {
      const meta = JSON.parse(init.body);
      if (!this.parentOk(meta.parents)) return notFound();
      return json(this.pub(this.add(meta)));
    }
    const one = /^\/drive\/v3\/files\/([^/]+)$/.exec(path);
    if (one) {
      const f = this.files.get(decodeURIComponent(one[1]));
      if (!f || f.trashed) return notFound();
      if (method === "GET" && url.searchParams.get("alt") === "media") return new Response(f.content, { headers: { "Content-Type": f.mimeType } });
      if (method === "GET") return json(this.pub(f));
      if (method === "PATCH") {
        const add = url.searchParams.get("addParents"), remove = url.searchParams.get("removeParents");
        f.parents = f.parents.filter((p) => p !== remove).concat(add ? [add] : []);
        return json(this.pub(f));
      }
    }
    const up = /^\/upload\/drive\/v3\/files(?:\/([^/]+))?$/.exec(path);
    if (up) {
      const id = up[1] && decodeURIComponent(up[1]);
      const type = url.searchParams.get("uploadType");
      if (type === "multipart") {
        const boundary = /boundary=(.+)$/.exec(init.headers["Content-Type"])[1];
        const bytes = new Uint8Array(await init.body.arrayBuffer());
        const s = new TextDecoder("windows-1252").decode(bytes); // one char per byte: indices are byte offsets
        const [, metaPart, mediaPart] = s.split(`--${boundary}`);
        const meta = JSON.parse(metaPart.slice(metaPart.indexOf("\r\n\r\n") + 4, -2));
        const mediaStart = s.indexOf("\r\n\r\n", s.indexOf(mediaPart)) + 4;
        const content = bytes.slice(mediaStart, s.lastIndexOf(`\r\n--${boundary}--`));
        return this.write(id, meta, content);
      }
      if (type === "resumable") {
        const meta = JSON.parse(init.body);
        const session = `https://www.googleapis.com/upload/drive/v3/session/${++this.seq}`;
        this.sessions ??= new Map();
        this.sessions.set(session, { id, meta });
        return new Response(null, { status: 200, headers: { Location: session } });
      }
    }
    if (path.startsWith("/upload/drive/v3/session/") && method === "PUT") {
      const { id, meta } = this.sessions.get(url.toString());
      return this.write(id, meta, new Uint8Array(await init.body.arrayBuffer()));
    }
    return json({ error: { message: `unhandled ${method} ${path}` } }, 400);
  };

  write(id, meta, content) {
    if (id) {
      const f = this.files.get(id);
      if (!f || f.trashed) return Response.json({ error: { message: "File not found" } }, { status: 404 });
      Object.assign(f, meta, { content, version: String(Number(f.version) + 1), modifiedTime: new Date(Date.UTC(2026, 0, 2, 0, 0, ++this.seq)).toISOString() });
      return Response.json(this.pub(f));
    }
    if (!this.parentOk(meta.parents)) return Response.json({ error: { message: "File not found" } }, { status: 404 });
    return Response.json(this.pub(this.add({ ...meta, content })));
  }
}

// ------------------------------------------------------------------ fake Google Identity Services
export function fakeGis(fd) {
  const gis = {
    calls: [], revoked: [], next: { expires_in: 3600 },
    accounts: { oauth2: {
      initTokenClient: (cfg) => ({
        requestAccessToken: (opts) => {
          gis.calls.push({ cfg, opts });
          setTimeout(() => {
            if (gis.next.error_type) return cfg.error_callback({ type: gis.next.error_type });
            fd.token = `tok${gis.calls.length}`;
            cfg.callback({ access_token: fd.token, expires_in: gis.next.expires_in, scope: cfg.scope });
          }, 0);
        },
      }),
      hasGrantedAllScopes: (r, scope) => r.scope === scope && !gis.next.denyScope,
      revoke: (t, done) => { gis.revoked.push(t); done(); },
    } },
  };
  return gis;
}

