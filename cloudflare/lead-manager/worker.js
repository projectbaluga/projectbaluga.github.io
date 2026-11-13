/**
 * ProjectBaluga Lead Manager — separate from the public AI assistant Worker.
 * Public intake stores only after FormSubmit has accepted the inquiry.
 * Admin routes require a valid Cloudflare Access JWT for the configured owner.
 */
const OWNER_EMAIL = "projectbaluga@gmail.com";
const ALLOWED_ORIGINS = new Set([
  "https://wiltek.cloud",
  "https://projectbaluga.github.io"
]);
const MAX_BODY = 12000;
const STATUSES = new Set(["New", "Contacted", "Qualified", "Won", "Lost"]);
let jwksCache = null;
let jwksFetchedAt = 0;

function json(data, status = 200, origin = "") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin"
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function readJson(request, maxBytes = MAX_BODY) {
  const contentType = request.headers.get("Content-Type") || "";
  if (!/^application\/json(?:\s*;|\s*$)/i.test(contentType)) throw new Error("invalid_content_type");
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_json");
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let parsed;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json");
  return parsed;
}

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

async function getJwks(teamDomain) {
  const now = Date.now();
  if (jwksCache && now - jwksFetchedAt < 10 * 60 * 1000) return jwksCache;
  const domain = teamDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9.-]+$/i.test(domain)) throw new Error("Invalid Access team domain.");
  const response = await fetch(`https://${domain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error("Could not retrieve Access signing keys.");
  jwksCache = await response.json();
  jwksFetchedAt = now;
  return jwksCache;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function verifyAccess(request, env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
    if (header.alg !== "RS256" || !header.kid) return false;
    const team = String(env.ACCESS_TEAM_DOMAIN).replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (claims.iss !== `https://${team}`) return false;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.includes(env.ACCESS_AUD)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (typeof claims.exp !== "number" || claims.exp <= now) return false;
    if (typeof claims.nbf === "number" && claims.nbf > now + 60) return false;
    if (String(claims.email || "").toLowerCase() !== OWNER_EMAIL) return false;
    const keys = await getJwks(team);
    const jwk = (keys.keys || []).find(key => key.kid === header.kid);
    if (!jwk) return false;
    const publicKey = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
    return await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, decodeBase64Url(parts[2]), signed);
  } catch {
    return false;
  }
}

async function requireAdmin(request, env) {
  return await verifyAccess(request, env);
}

function adminPage() {
  return new Response(ADMIN_HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer"
    }
  });
}

const ADMIN_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lead Manager | ProjectBaluga</title>
<style>
:root{color-scheme:dark;--bg:#101522;--panel:#192235;--line:#2b3850;--muted:#aab5c8;--ink:#f4f6fb;--accent:#a99cff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif}
main{max-width:1180px;margin:auto;padding:32px 20px}header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
h1{font-size:clamp(26px,4vw,38px);margin:0}p{color:var(--muted)}.meta{font-size:13px;color:var(--muted)}
.controls{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0}input,select,button,textarea{font:inherit;border-radius:10px;border:1px solid var(--line);padding:10px 12px;background:#111a2a;color:var(--ink)}
input{min-width:220px;flex:1}button{cursor:pointer;background:#6658c9;border:0;font-weight:650}button.secondary{background:#27334a}
table{width:100%;border-collapse:collapse;min-width:760px}th,td{text-align:left;padding:13px 12px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.wrap{overflow:auto;background:var(--panel);border:1px solid var(--line);border-radius:14px}.detail{white-space:pre-wrap;max-width:340px;overflow-wrap:anywhere}.status{min-width:125px}
#message{min-height:24px;color:var(--accent)}.empty{padding:32px;text-align:center;color:var(--muted)}
@media(max-width:600px){main{padding:22px 12px}.controls>*{width:100%}}
</style></head><body><main>
<header><div><p class="meta">PROJECTBALUGA / PRIVATE WORKSPACE</p><h1>Lead Manager</h1><p>Owner access · project inquiries</p></div><button id="refresh" class="secondary">Refresh leads</button></header>
<div class="controls"><input id="search" type="search" placeholder="Search name, business, email or project"><select id="filter"><option value="">All statuses</option><option>New</option><option>Contacted</option><option>Qualified</option><option>Won</option><option>Lost</option></select></div>
<p id="message" role="status" aria-live="polite">Loading leads…</p>
<div class="wrap"><table><thead><tr><th>Received</th><th>Contact</th><th>Project</th><th>Budget / Timeline</th><th>Status</th></tr></thead><tbody id="leads"></tbody></table><div id="empty" class="empty" hidden>No leads found.</div></div>
<p class="meta">Lead details are private. Update a status to track follow-up. No messages are sent automatically.</p>
</main>
<script>
const body=document.getElementById('leads'),message=document.getElementById('message');
let records=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(){
 const q=document.getElementById('search').value.toLowerCase(),f=document.getElementById('filter').value;
 const rows=records.filter(x=>(!f||x.status===f)&&[x.name,x.email,x.business,x.details].join(' ').toLowerCase().includes(q));
 body.innerHTML=rows.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td><strong>'+esc(x.name)+'</strong><br>'+esc(x.email)+'<br>'+esc(x.phone)+'<br>'+esc(x.business)+'</td><td><strong>'+esc(x.service)+'</strong><div class="detail">'+esc(x.details)+'</div></td><td>'+esc(x.budget||'Not specified')+'<br>'+esc(x.timeline||'Flexible')+'</td><td><select class="status" data-id="'+esc(x.id)+'">'+['New','Contacted','Qualified','Won','Lost'].map(s=>'<option'+(s===x.status?' selected':'')+'>'+s+'</option>').join('')+'</select></td></tr>').join('');
 document.getElementById('empty').hidden=rows.length>0;
 body.querySelectorAll('select[data-id]').forEach(el=>el.addEventListener('change',()=>updateStatus(el.dataset.id,el.value)));
}
async function load(){
 message.textContent='Loading leads…';
 try{const r=await fetch('/api/admin/leads');if(!r.ok)throw new Error(r.status===401||r.status===403?'Access denied. Sign in with the owner account.':'Could not load leads.');
 const d=await r.json();records=d.leads||[];render();message.textContent=records.length+' lead(s)';}
 catch(e){message.textContent=e.message;}
}
async function updateStatus(id,status){
 try{const r=await fetch('/api/admin/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})});if(!r.ok)throw new Error('Could not update status.');message.textContent='Status updated.';await load();}
 catch(e){message.textContent=e.message;await load();}
}
document.getElementById('refresh').addEventListener('click',load);
document.getElementById('search').addEventListener('input',render);
document.getElementById('filter').addEventListener('change',render);
load();
</script></body></html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin"
      }});
    }

    if (url.pathname === "/api/intake") {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
      if (!ALLOWED_ORIGINS.has(origin)) return json({ error: "Origin not allowed." }, 403, origin);
      if (!env.LEADS_DB || !env.LEAD_INTAKE_LIMITER) return json({ error: "Lead intake is not configured." }, 503, origin);
      try {
        const { success } = await env.LEAD_INTAKE_LIMITER.limit({
          key: request.headers.get("CF-Connecting-IP") || "unknown"
        });
        if (!success) return json({ error: "Please wait before submitting another inquiry." }, 429, origin);
        const body = await readJson(request);
        const lead = {
          name: clean(body.name, 100),
          email: clean(body.email, 160),
          phone: clean(body.phone, 40),
          business: clean(body.business, 120),
          service: clean(body.service, 100),
          details: clean(body.details, 2000),
          budget: clean(body.budget, 80),
          timeline: clean(body.timeline, 80)
        };
        if (!lead.name || !validEmail(lead.email) || !lead.service || !lead.details) {
          return json({ error: "Required inquiry fields are missing or invalid." }, 400, origin);
        }
        await env.LEADS_DB.prepare(
          "INSERT INTO leads (name,email,phone,business,service,details,budget,timeline,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
        ).bind(lead.name,lead.email,lead.phone,lead.business,lead.service,lead.details,lead.budget,lead.timeline,"New",new Date().toISOString()).run();
        return json({ ok: true }, 201, origin);
      } catch (error) {
        if (error.message === "too_large") return json({ error: "Request too large." }, 413, origin);
        if (error.message === "invalid_content_type") return json({ error: "Content-Type must be application/json." }, 415, origin);
        if (error.message === "invalid_json") return json({ error: "Invalid request." }, 400, origin);
        console.error("Lead intake failed:", error?.message || "unknown error");
        return json({ error: "Lead could not be saved." }, 503, origin);
      }
    }

    if (url.pathname === "/health") return json({ ok: true, service: "projectbaluga-lead-manager" }, 200, origin);

    // Admin UI and API must only be served on the protected custom domain.
    // Keep /api/intake available on workers.dev for the public website integration.
    if (url.hostname !== "admin.wiltek.cloud") {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    if (!await requireAdmin(request, env)) {
      return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return adminPage();
    }
    if (url.pathname === "/api/admin/leads" && request.method === "GET") {
      const result = await env.LEADS_DB.prepare(
        "SELECT id,name,email,phone,business,service,details,budget,timeline,status,created_at FROM leads ORDER BY created_at DESC LIMIT 500"
      ).all();
      return json({ leads: result.results || [] });
    }
    if (url.pathname === "/api/admin/status" && request.method === "POST") {
      try {
        const body = await readJson(request, 1000);
        const id = Number(body.id);
        const status = clean(body.status, 20);
        if (!Number.isSafeInteger(id) || id < 1 || !STATUSES.has(status)) return json({ error: "Invalid update." }, 400);
        const result = await env.LEADS_DB.prepare("UPDATE leads SET status = ? WHERE id = ?").bind(status,id).run();
        if (!result.meta?.changes) return json({ error: "Lead not found." }, 404);
        return json({ ok: true });
      } catch {
        return json({ error: "Could not update lead." }, 400);
      }
    }
    return new Response("Not found", { status: 404 });
  }
};
