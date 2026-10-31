import { getStore } from "@netlify/blobs";
export const config = { path: "/api/*" };
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const day = (off = 0) => new Date(Date.now() + 3 * 36e5 - off * 864e5).toISOString().slice(0, 10);
const txt = (v, n) => String(v ?? "").slice(0, n);
const num = (v) => Math.max(0, Number(v) || 0);
export default async (req) => {
  const store = getStore("cafe");
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const m = req.method;
  const pass = process.env.ADMIN_PASSWORD;
  const admin = !!pass && req.headers.get("x-admin-key") === pass;
  const get = async (k, d) => (await store.get(k, { type: "json" })) ?? d;

  if (path === "menu" && m === "GET")
    return J({ menu: await get("menu", { categories: [] }), settings: await get("settings", { open: true, from: "10:00", to: "00:00" }) });

  if (path.startsWith("photo/") && m === "GET") {
    const id = path.slice(6);
    if (!/^[\w-]{8,64}$/.test(id)) return new Response("", { status: 404 });
    const data = await store.get("photo:" + id, { type: "arrayBuffer" });
    return data ? new Response(data, { headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } }) : new Response("", { status: 404 });
  }

  if (path === "order" && m === "POST") {
    const s = await get("settings", { open: true });
    if (s.open === false) return J({ error: "closed" }, 403);
    let b; try { b = await req.json(); } catch { return J({ error: "bad" }, 400); }
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 60).map((i) => ({ name: txt(i.name, 120), qty: Math.min(99, Math.max(1, Math.round(num(i.qty)))), price: num(i.price) }));
    if (!items.length) return J({ error: "empty" }, 400);
    const o = { id: crypto.randomUUID().slice(0, 8), time: new Date().toISOString(), type: b.type === "masa" ? "masa" : "paket", table: txt(b.table, 10), total: num(b.total), name: txt(b.name, 80), phone: txt(b.phone, 20), address: txt(b.address, 300), items };
    const k = "orders:" + day();
    const list = await get(k, []);
    list.push(o);
    await store.setJSON(k, list);
    if (list.length === 1) {
      const old = day(180);
      for (const { key } of (await store.list({ prefix: "orders:" })).blobs) if (key.slice(7) < old) await store.delete(key);
    }
    return J({ ok: true });
  }

  if (!admin) return J({ error: "auth" }, 401);
  if (path === "check") return J({ ok: true });
  if (path === "orders" && m === "GET") {
    const n = Math.min(90, Math.max(1, +url.searchParams.get("days") || 1));
    const all = await Promise.all(Array.from({ length: n }, (_, i) => get("orders:" + day(i), [])));
    return J({ orders: all.flat().sort((a, b) => b.time.localeCompare(a.time)) });
  }
  if (path === "menu" && m === "PUT") {
    const b = await req.json();
    if (!Array.isArray(b.categories)) return J({ error: "bad" }, 400);
    await store.setJSON("menu", b);
    return J({ ok: true });
  }
  if (path === "settings" && m === "PUT") {
    const b = await req.json();
    await store.setJSON("settings", { open: b.open !== false, from: txt(b.from, 5), to: txt(b.to, 5) });
    return J({ ok: true });
  }
  if (path === "photo" && m === "POST") {
    const buf = await req.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 800000) return J({ error: "size" }, 413);
    const id = crypto.randomUUID();
    await store.set("photo:" + id, buf);
    return J({ id });
  }
  return J({ error: "404" }, 404);
};
