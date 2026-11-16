const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const upload = document.getElementById("upload");
const zoomInput = document.getElementById("zoom");
const download = document.getElementById("download");

const SIZE = canvas.width;
const RADIUS = SIZE / 2;

let img = null;
let baseScale = 1;
let userScale = 1;
let offsetX = 0;
let offsetY = 0;
let dragging = false;
let startX, startY;

// Load main frame asset (Asset 6@4x.png, base64 from frame-data.js prevents CORS/tainted canvas errors on file:// protocol)
const frame = new Image();

// Always attach listeners BEFORE setting src so cached or data: URLs never miss onload
frame.onload = () => {
  draw();
};

frame.onerror = () => {
  // If frame-2048.png fails, fall back to Asset 6@4x.png
  if (!frame.src.includes("Asset")) {
    frame.src = "Asset 6@4x.png";
  }
};

if (typeof window !== "undefined" && window.FRAME_DATA) {
  frame.src = window.FRAME_DATA;
} else {
  frame.src = "frame-2048.png";
}

// Mobile detection
const isMobile = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isMobile) zoomInput.step = 0.02;

// Draw stylish Orange & Black empty state placeholder
function drawPlaceholder() {
  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "#101014";
  ctx.fill();

  // Subtle dashed orange guide ring
  ctx.strokeStyle = "rgba(249, 115, 22, 0.4)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.arc(RADIUS, RADIUS, RADIUS - 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Placeholder camera icon
  const cx = RADIUS;
  const cy = RADIUS - 22;

  ctx.strokeStyle = "#f97316";
  ctx.fillStyle = "rgba(249, 115, 22, 0.12)";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(cx - 26, cy - 14, 52, 38, 8);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.strokeRect(cx - 26, cy - 14, 52, 38);
  }

  // Camera lens
  ctx.beginPath();
  ctx.arc(cx, cy + 5, 11, 0, Math.PI * 2);
  ctx.stroke();

  // Small camera top flash
  ctx.beginPath();
  ctx.rect(cx - 10, cy - 20, 20, 6);
  ctx.fillStyle = "#f97316";
  ctx.fill();

  // Text
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Upload Photo", RADIUS, RADIUS + 44);

  ctx.fillStyle = "#a1a1aa";
  ctx.font = "400 12px system-ui, -apple-system, sans-serif";
  ctx.fillText("Click button to select your image", RADIUS, RADIUS + 66);

  ctx.restore();

  // Draw frame overlay if loaded
  if (frame.complete && frame.naturalWidth !== 0) {
    ctx.drawImage(frame, 0, 0, SIZE, SIZE);
  }
}

// Cover-scale (Convocation-style)
function calculateCoverScale(image) {
  return Math.max(SIZE / image.width, SIZE / image.height);
}

// Draw canvas
function draw() {
  if (!img) {
    drawPlaceholder();
    return;
  }

  ctx.clearRect(0, 0, SIZE, SIZE);

  const scale = baseScale * userScale;
  const drawW = img.width * scale;
  const drawH = img.height * scale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(RADIUS, RADIUS, RADIUS, 0, Math.PI * 2);
  ctx.clip();

  ctx.drawImage(
    img,
    RADIUS + offsetX - drawW / 2,
    RADIUS + offsetY - drawH / 2,
    drawW,
    drawH
  );

  ctx.restore();

  // Overlay frame if loaded
  if (frame.complete && frame.naturalWidth !== 0) {
    ctx.drawImage(frame, 0, 0, SIZE, SIZE);
  }
}

// Smart face centering
async function smartCenterFace(image) {
  if (!("FaceDetector" in window)) return;

  try {
    const detector = new FaceDetector({ fastMode: true });
    const faces = await detector.detect(image);
    if (!faces.length) return;

    const face = faces[0].boundingBox;
    const faceCenterX = face.x + face.width / 2;
    const faceCenterY = face.y + face.height / 2;

    offsetX = -(faceCenterX - image.width / 2) * baseScale;
    offsetY = -(faceCenterY - image.height / 2) * baseScale;
  } catch {}
}

// Upload
upload.addEventListener("change", e => {
  if (!e.target.files || !e.target.files[0]) return;
  img = new Image();
  img.onload = async () => {
    baseScale = calculateCoverScale(img);
    userScale = 1;
    zoomInput.value = 1;
    offsetX = 0;
    offsetY = 0;
    await smartCenterFace(img);
    draw();
  };
  img.src = URL.createObjectURL(e.target.files[0]);
});

// Zoom
zoomInput.addEventListener("input", () => {
  userScale = parseFloat(zoomInput.value);
  draw();
});

// Drag (Mouse)
canvas.addEventListener("mousedown", e => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  canvas.style.cursor = "grabbing";
});

window.addEventListener("mouseup", () => {
  dragging = false;
  canvas.style.cursor = "grab";
});

window.addEventListener("mousemove", e => {
  if (!dragging || !img) return;
  offsetX += e.clientX - startX;
  offsetY += e.clientY - startY;
  startX = e.clientX;
  startY = e.clientY;
  draw();
});

// Drag (Touch support for smartphones/tablets)
canvas.addEventListener("touchstart", e => {
  if (e.touches.length === 1) {
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }
}, { passive: true });

window.addEventListener("touchend", () => {
  dragging = false;
});

window.addEventListener("touchmove", e => {
  if (!dragging || !img || e.touches.length !== 1) return;
  offsetX += e.touches[0].clientX - startX;
  offsetY += e.touches[0].clientY - startY;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  draw();
}, { passive: true });

// Export (HD / Ultra HD)
download.addEventListener("click", () => {
  if (!img) {
    alert("Please upload a photo first!");
    return;
  }

  const qualityInput = document.querySelector('input[name="quality"]:checked');
  const size = Number(qualityInput ? qualityInput.value : 1200);

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d");

  // Save context state before clipping
  octx.save();
  octx.beginPath();
  octx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  octx.clip();

  const scale = baseScale * userScale * (size / SIZE);
  const drawW = img.width * scale;
  const drawH = img.height * scale;

  octx.drawImage(
    img,
    size / 2 + offsetX * (size / SIZE) - drawW / 2,
    size / 2 + offsetY * (size / SIZE) - drawH / 2,
    drawW,
    drawH
  );

  // Restore unclipped context for the frame overlay
  octx.restore();

  // Draw frame on top
  if (frame.complete && frame.naturalWidth !== 0) {
    octx.drawImage(frame, 0, 0, size, size);
  }

  const fileName = `uiu-career-fest-2026-dp-${size}.png`;

  function triggerDownload(url) {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    }, 2000);
  }

  try {
    if (out.toBlob) {
      out.toBlob(blob => {
        if (blob) {
          triggerDownload(URL.createObjectURL(blob));
        } else {
          // Fallback to data URL
          try {
            triggerDownload(out.toDataURL("image/png", 1.0));
          } catch (err) {
            console.error("Export error:", err);
            alert("Could not generate image. Please make sure the frame image is loaded properly.");
          }
        }
      }, "image/png");
    } else {
      triggerDownload(out.toDataURL("image/png", 1.0));
    }
  } catch (err) {
    console.error("Download error:", err);
    try {
      triggerDownload(out.toDataURL("image/png", 1.0));
    } catch (e2) {
      alert("Export failed: " + (err.message || "Canvas tainted or permission blocked"));
    }
  }
});

// Initial draw
draw();
if (frame.complete && frame.naturalWidth !== 0) {
  draw();
}
