let currentCols = 10; // default, will be set by setGrid
let currentRows = 7;  // default, will be set by setGrid

function setGrid(cols, rows) {
  currentCols = cols;
  currentRows = rows;
  const dash = document.getElementById("dashboard");
  dash.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  dash.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  dash.style.justifyContent = "center"; // extra horizontal space on left/right
  dash.style.alignContent = "start";    // extra vertical space at bottom
}

function addTile({
  image,
  label,
  x,
  y,
  width,
  height,
  url,            // used for iframe or navigation
  type,
  method,
  payload,
  targetUrl,      // NEW: main target for webhooks
  displayLabel,
  statusCheckUrl, // NEW: optional; if empty, fallback to targetUrl
}) {
  const dash = document.getElementById("dashboard");
  const tile = document.createElement("div");
  tile.className = "tile";
  tile.style.gridColumn = `${x} / span ${width}`;
  tile.style.gridRow = `${y} / span ${height}`;

  if (type === "widget") {
    // iFrame widget tile
    const iframe = document.createElement("iframe");
    iframe.src = url;
    tile.appendChild(iframe);

  } else if (type === "webhook") {
    // Webhook tile (no icon/label)
    const content = document.createElement("div");
    content.className = "webhook-response";
    tile.appendChild(content);

    const checkUrl = statusCheckUrl || targetUrl;

    function fetchStatus() {
      fetch(checkUrl, { method: "GET" })
        .then((res) => res.text())
        .then((html) => { content.innerHTML = html; })
        .catch((err) => { content.innerHTML = `<div class="error">Error: ${err.message}</div>`; });
    }

    function triggerAction() {
      const options = method === "POST" ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      } : { method: "GET" };

      fetch(targetUrl, options)
        .then((res) => res.text())
        .then((html) => { content.innerHTML = html; })
        .catch((err) => { content.innerHTML = `<div class="error">Error: ${err.message}</div>`; });
    }

    fetchStatus();
    tile.addEventListener("click", triggerAction);

  } else if (type === "button") {
    // Button tile (icon + label, triggers webhook on click)
    const img = document.createElement("img");
    img.src = image || "";
    const text = document.createElement("span");
    text.textContent = label || "";
    tile.appendChild(img);
    tile.appendChild(text);

    tile.addEventListener("click", () => {
      const options = method === "POST" ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      } : { method: "GET" };

      fetch(url, options)
        .then((res) => {
          if (res.ok) {
            tile.style.transform = "scale(0.95)";
            setTimeout(() => { tile.style.transform = ""; }, 200);
          }
        })
        .catch((err) => console.error("Button webhook error:", err));
    });

  } else if (type === "toggle") {
    // Toggle tile (icon + label, switches between two states)
    const img = document.createElement("img");
    const text = document.createElement("span");
    text.textContent = label || "";
    tile.appendChild(img);
    if (displayLabel) {
      tile.appendChild(text);
    } else {
      img.className = "toggle-icon";
      tile.className = "tile no-padding";
    }

    let currentState = false;

    function updateDisplay() {
      img.src = currentState ? targetUrl.trueImage : targetUrl.falseImage;
    }

    function checkStatus() {
      fetch(statusCheckUrl, { method: "GET" })
        .then((res) => res.json())
        .then((data) => {
          console.log("DATA RETURNED FROM N*N for:" + statusCheckUrl + data + typeof (data));
          currentState = data === true || data === "true";
          console.log("DATA stored FROM N*N:" + currentState);

          updateDisplay();
        })
        .catch((err) => {
          console.error("Toggle status check error:", err);
          img.classList.add("unreachable");
        });
    }

    tile.addEventListener("click", () => {
      const toggleUrl = currentState ? targetUrl.falseUrl : targetUrl.trueUrl;
      const options = method === "POST" ? {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload || {}),
      } : { method: "GET" };

      fetch(toggleUrl, options)
        .then((res) => {
          if (res.ok) {
            tile.style.transform = "scale(0.95)";
            setTimeout(() => {
              tile.style.transform = "";
              checkStatus(); // Refresh status after toggle
            }, 200);
          }
        })
        .catch((err) => console.error("Toggle webhook error:", err));
    });

    checkStatus(); // Check only on page load

  } else {
    // Normal tile (icon + label)
    const img = document.createElement("img");
    img.src = image || "";
    const text = document.createElement("span");
    text.textContent = label || "";
    tile.appendChild(img);
    tile.appendChild(text);

    tile.addEventListener("click", () => {
      if (type === "new") window.open(url, "_blank");
      else if (type === "same") window.location.href = url;
    });

    // Reachability check
    if (type === "same" || type === "new") {
      const checkUrl = statusCheckUrl || url;
      const checkReachability = async () => {
        try {
          const res = await fetch(checkUrl, { method: "GET", cache: "no-store" });
          if (res.ok) img.classList.remove("unreachable");
          else img.classList.add("unreachable");
        } catch {
          img.classList.add("unreachable");
        }
      };
      checkReachability();
      setInterval(checkReachability, 60000);
    }
  }

  dash.appendChild(tile);
}

function renderDashboard(config) {
  const dash = document.getElementById("dashboard");
  dash.innerHTML = "";
  setGrid(config.cols, config.rows);
  config.tiles.forEach((t) => addTile(t));
  resizeGridSquares();
}

function chooseConfig() {
  const matched = breakpointConfigs.find(({ mediaQuery }) =>
    window.matchMedia(mediaQuery).matches
  );

  // Fallback if no media query matches
  console.log("Using Config: ", matched.name);
  const config = matched ? matched.config : landscapeConfig;

  renderDashboard(config);
  initScreenSizeOverlay(matched.name);
}


// Resize tiles to be square while keeping grid unchanged
function resizeGridSquares() {
  const dash = document.getElementById("dashboard");
  const containerWidth = dash.clientWidth;
  const containerHeight = dash.clientHeight;

  const tileWidth = containerWidth / currentCols;
  const tileHeight = containerHeight / currentRows;
  const tileSize = Math.min(tileWidth, tileHeight);

  dash.style.gridAutoRows = `${tileSize}px`;

  // Add extra space at bottom if vertical leftover
  dash.style.height = `${tileSize * currentRows}px`;
  // Add extra space on left/right if horizontal leftover
  dash.style.width = `${tileSize * currentCols}px`;
  dash.style.marginLeft = `${(containerWidth - (tileSize * currentCols)) / 2}px`;
  dash.style.marginRight = `${(containerWidth - (tileSize * currentCols)) / 2}px`;
}

// Initial load
chooseConfig();


// Resize handling
window.addEventListener("resize", () => {
  chooseConfig();
  resizeGridSquares();
});

function initScreenSizeOverlay(title) {
  const overlay = document.createElement("div");
  overlay.id = "screen-size-overlay";

  Object.assign(overlay.style, {
    position: "fixed",
    bottom: "8px",
    right: "8px",
    padding: "4px 8px",
    fontSize: "12px",
    fontFamily: "monospace",
    background: "rgba(0, 0, 0, 0.6)",
    color: "#fff",
    borderRadius: "4px",
    zIndex: "9999",
    pointerEvents: "none", // important: don’t block clicks
    textAlign: "right",
  });

  document.body.appendChild(overlay);

  function update() {
    overlay.innerHTML = `${window.innerWidth} × ${window.innerHeight}<br/>${title}`;
  }

  update();
  window.addEventListener("resize", update);
}

