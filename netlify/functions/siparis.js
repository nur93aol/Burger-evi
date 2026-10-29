exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "no" };
  let m = "";
  try { m = String(JSON.parse(event.body || "{}").m || ""); } catch (e) {}
  if (m.length < 10 || m.length > 1500 || !/^Yeni (paket sipariş|masa siparişi)/.test(m)) {
    return { statusCode: 400, body: "bad" };
  }
  const token = process.env.PUSHOVER_TOKEN, user = process.env.PUSHOVER_USER;
  if (!token || !user) return { statusCode: 500, body: "config" };
  const masa = /^Yeni masa/.test(m);
  const body = new URLSearchParams({
    token, user,
    title: masa ? "🍔 Yeni MASA siparişi" : "🍔 Yeni PAKET sipariş",
    message: m.slice(0, 1000),
    priority: "2", retry: "30", expire: "900", sound: "persistent"
  });
  try {
    const r = await fetch("https://api.pushover.net/1/messages.json", { method: "POST", body });
    return { statusCode: r.ok ? 200 : 502, body: r.ok ? "ok" : "fail" };
  } catch (e) {
    return { statusCode: 502, body: "err" };
  }
};
