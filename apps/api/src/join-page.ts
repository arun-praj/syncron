function pageScript(extensionId: string): string {
  return `(function(){
  var EXTENSION_ID = ${JSON.stringify(extensionId)};
  var invite = new URLSearchParams(location.hash.slice(1)).get("invite");
  history.replaceState(null, "", location.pathname + location.search);
  var states = document.querySelectorAll("[data-state]");
  var mic = false;
  var camera = false;
  var preview = null;
  var extensionReady = false;
  function show(id) {
    for (var i = 0; i < states.length; i++) states[i].classList.toggle("active", states[i].getAttribute("data-state") === id);
  }
  function message(type, extra) {
    var payload = { type: type };
    for (var key in extra || {}) payload[key] = extra[key];
    return new Promise(function(resolve, reject) {
      if (!EXTENSION_ID || typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error("MISSING_EXTENSION"));
        return;
      }
      chrome.runtime.sendMessage(EXTENSION_ID, payload, function(response) {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message || "EXTENSION_ERROR"));
        else resolve(response);
      });
    });
  }
  function text(id, value) { document.getElementById(id).textContent = value || ""; }
  function setToggle(id, value) {
    var button = document.getElementById(id);
    button.setAttribute("aria-pressed", String(value));
    button.classList.toggle("enabled", value);
    button.querySelector("[data-value]").textContent = value ? "On" : "Off";
  }
  function thumbnail(media) {
    var id = media && media.mediaId;
    if (!id && media && media.url) {
      try { id = new URL(media.url).searchParams.get("v"); } catch (_) {}
    }
    var image = document.getElementById("video-thumbnail");
    var fallback = document.getElementById("thumbnail-fallback");
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
      image.removeAttribute("src");
      image.classList.add("hidden");
      fallback.classList.remove("hidden");
      return;
    }
    image.onload = function() { image.classList.remove("hidden"); fallback.classList.add("hidden"); };
    image.onerror = function() { image.classList.add("hidden"); fallback.classList.remove("hidden"); };
    image.src = "https://i.ytimg.com/vi/" + encodeURIComponent(id) + "/hqdefault.jpg";
  }
  function render(p) {
    preview = p;
    text("room-name", p.name || "Watch party");
    text("video-title", p.title || "YouTube video");
    text("host-name", "Hosted by " + (p.host.displayName || "Syncron user"));
    text("participant-count", p.participantCount + " of " + p.maxParticipants + " participants");
    text("control-setting", p.everyoneCanControl ? "Everyone can control playback" : "Only the host can control playback");
    text("invite-setting", p.allowMembersToShareInvite ? "Members can share the invite" : "Only the host can invite");
    thumbnail(p.media);
    var full = p.participantCount >= p.maxParticipants;
    document.getElementById("full-note").classList.toggle("hidden", !full);
    document.getElementById("join-btn").disabled = full;
    show("lobby");
  }
  function failure(messageText, retry) {
    var value = messageText || "Please try again.";
    var state = value.indexOf("Sign in to Syncron") === 0 ? "unauthenticated" :
      value.indexOf("doesn't have anything playing") >= 0 ? "empty" :
      value.indexOf("supports YouTube") >= 0 ? "unsupported" : "error";
    var notices = document.querySelectorAll("[data-message]");
    for (var i = 0; i < notices.length; i++) notices[i].textContent = value;
    document.getElementById("retry-btn").classList.toggle("hidden", !retry || state !== "error");
    show(state);
  }
  document.getElementById("mic-toggle").addEventListener("click", function() { mic = !mic; setToggle("mic-toggle", mic); });
  document.getElementById("camera-toggle").addEventListener("click", function() { camera = !camera; setToggle("camera-toggle", camera); });
  document.getElementById("retry-btn").addEventListener("click", function() { load(); });
  document.getElementById("join-btn").addEventListener("click", function() {
    if (!preview) return;
    var button = document.getElementById("join-btn");
    button.disabled = true;
    button.textContent = "Joining…";
    show("joining");
    message("syncron:join-invite", { invite: invite, microphoneEnabled: mic, cameraEnabled: camera }).then(function(response) {
      if (!response || !response.ok || typeof response.destination !== "string") {
        failure(response && response.message, true);
        return;
      }
      location.replace(response.destination);
    }).catch(function() { failure("Couldn't reach the Syncron extension.", true); });
  });
  function load() {
    show("loading");
    extensionReady = false;
    if (!invite) { failure("This invite link is missing its invite code.", false); return; }
    message("syncron:ping").then(function(response) {
      if (!response || !response.ok) throw new Error("MISSING_EXTENSION");
      extensionReady = true;
      return message("syncron:preview-invite", { invite: invite });
    }).then(function(response) {
      if (!response || !response.ok) { failure(response && response.message, true); return; }
      if (!response.preview || !response.preview.media) { failure("This party doesn't have anything playing yet.", false); return; }
      if (response.preview.media.provider !== "YOUTUBE") { failure("Syncron currently supports YouTube watch parties only.", false); return; }
      render(response.preview);
    }).catch(function(error) {
      if (!extensionReady || (error && error.message === "MISSING_EXTENSION")) show("missing");
      else failure("Couldn't load this party. Please try again.", true);
    });
  }
  setToggle("mic-toggle", false);
  setToggle("camera-toggle", false);
  if (!EXTENSION_ID || !invite) { show("missing"); }
  else load();
})();`;
}

export function renderJoinPage(extensionId: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Join Syncron party</title>
  <style>
    :root{color-scheme:light;--canvas:#f5f5f5;--surface:#fff;--text:#404040;--strong:#0a0a0a;--muted:#737373;--border:#e5e5e5;--brand:#1e90ff;--brand-light:#5cb3ff;--danger:#dc2626;--radius:12px;--font:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
    @media(prefers-color-scheme:dark){:root{color-scheme:dark;--canvas:#0a0a0a;--surface:#171717;--text:#d4d4d4;--strong:#fff;--muted:#a3a3a3;--border:#404040}}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--canvas);color:var(--text);font:14px/20px var(--font)}main{width:min(100%,520px);padding:28px;border:1px solid var(--border);border-radius:18px;background:var(--surface);box-shadow:0 8px 30px rgb(0 0 0 / 10%)}.brand{margin:0 0 24px;color:var(--strong);font-size:18px;font-weight:700;letter-spacing:-.02em}.brand span{color:var(--brand)}h1{margin:0;color:var(--strong);font-size:28px;line-height:36px;letter-spacing:-.03em}p{margin:8px 0;color:var(--muted)}.state{display:none}.state.active{display:block}.center{text-align:center;padding:24px 4px}.spinner{width:28px;height:28px;margin:0 auto 16px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:spin .8s linear infinite}.preview{overflow:hidden;margin:24px 0;border:1px solid var(--border);border-radius:14px}.thumbnail{position:relative;aspect-ratio:16/9;background:linear-gradient(135deg,#12304d,#1e90ff 55%,#111827);display:grid;place-items:center}.thumbnail img{width:100%;height:100%;object-fit:cover}.thumbnail img.hidden,.hidden{display:none}.thumbnail-fallback{color:#fff;font-size:22px;font-weight:700;letter-spacing:.04em}.video-copy{padding:14px 16px}.room{margin:0 0 2px;color:var(--muted);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.06em}.video-title{margin:0;color:var(--strong);font-size:16px;font-weight:650}.meta{margin-top:4px;font-size:13px}.setting-list{margin:20px 0;border-top:1px solid var(--border)}.setting{display:flex;gap:12px;align-items:center;padding:13px 0;border-bottom:1px solid var(--border)}.setting-icon{width:28px;color:var(--brand);font-size:18px;text-align:center}.setting-copy{flex:1}.setting-label{color:var(--strong);font-weight:600}.setting-value{margin-top:2px;color:var(--muted);font-size:13px}.toggle-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0}.toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:transparent;color:var(--strong);font:600 14px/20px var(--font);cursor:pointer}.toggle:hover,.toggle:focus-visible{border-color:var(--brand)}.toggle:focus-visible,.btn:focus-visible{outline:3px solid rgb(30 144 255 / 30%);outline-offset:2px}.toggle.enabled{border-color:var(--brand);background:rgb(30 144 255 / 8%)}.toggle [data-value]{color:var(--muted);font-size:12px}.btn{width:100%;padding:12px 18px;border:0;border-radius:10px;cursor:pointer;color:#fff;background:linear-gradient(to bottom,var(--brand-light),var(--brand));font:650 15px/22px var(--font)}.btn:disabled{opacity:.6;cursor:default}.note{margin-top:12px;color:var(--danger);font-size:13px;text-align:center}.error-title{color:var(--strong);font-size:20px;font-weight:700}.error .btn{margin-top:18px}.footer{margin-top:20px;color:var(--muted);font-size:12px;text-align:center}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:520px){body{padding:12px}main{padding:22px 18px;border-radius:14px}h1{font-size:24px;line-height:32px}.toggle-row{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
  </style>
</head>
<body>
<main>
  <div class="brand"><span>●</span> Syncron</div>
  <section class="state active" data-state="loading"><div class="center"><div class="spinner" aria-hidden="true"></div><h1>Loading watch party</h1><p>Checking the invite and your Syncron extension.</p></div></section>
  <section class="state" data-state="missing"><div class="center"><div class="error-title">Open this link in Syncron</div><p>Install or enable the Syncron extension, then reopen this invite link.</p></div></section>
  <section class="state" data-state="unauthenticated"><div class="center"><div class="error-title">Sign in to Syncron</div><p data-message>Sign in to Syncron first, then reopen this invite link.</p></div></section>
  <section class="state" data-state="empty"><div class="center"><div class="error-title">The party has no video yet</div><p data-message></p></div></section>
  <section class="state" data-state="unsupported"><div class="center"><div class="error-title">Unsupported party media</div><p data-message></p></div></section>
  <section class="state" data-state="error"><div class="center error"><div class="error-title">We couldn't load this party</div><p data-message></p><button class="btn" id="retry-btn" type="button">Try again</button></div></section>
  <section class="state" data-state="joining"><div class="center"><div class="spinner" aria-hidden="true"></div><h1>Joining watch party</h1><p>Getting the room ready in this tab.</p></div></section>
  <section class="state" data-state="lobby">
    <h1>Join watch party</h1>
    <p id="host-name"></p>
    <div class="preview">
      <div class="thumbnail"><img id="video-thumbnail" alt=""><div id="thumbnail-fallback" class="thumbnail-fallback">SYNCRON</div></div>
      <div class="video-copy"><p id="room-name" class="room"></p><p id="video-title" class="video-title"></p><p id="participant-count" class="meta"></p></div>
    </div>
    <div class="setting-list" aria-label="Host settings">
      <div class="setting"><div class="setting-icon" aria-hidden="true">▶</div><div class="setting-copy"><div class="setting-label">Playback control</div><div id="control-setting" class="setting-value"></div></div></div>
      <div class="setting"><div class="setting-icon" aria-hidden="true">↗</div><div class="setting-copy"><div class="setting-label">Invite sharing</div><div id="invite-setting" class="setting-value"></div></div></div>
    </div>
    <div class="toggle-row" aria-label="Join preferences">
      <button id="mic-toggle" class="toggle" type="button" aria-pressed="false"><span>Microphone</span><span data-value>Off</span></button>
      <button id="camera-toggle" class="toggle" type="button" aria-pressed="false"><span>Camera</span><span data-value>Off</span></button>
    </div>
    <p id="full-note" class="note hidden">This party is full. You can preview it, but cannot join right now.</p>
    <button id="join-btn" class="btn" type="button">Join party</button>
    <div class="footer">Your device preferences can be changed after you join.</div>
  </section>
</main>
<script>${pageScript(extensionId)}</script>
</body>
</html>`;
}
