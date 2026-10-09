/* Deform a two-sided sheet into a curved surface; all content stays HTML.
 * Each band is a tangent patch of the integrated sheet profile, not a rigid leaf.
 * At both endpoints the sheet is flat and exactly coincides with a static page.
 */
globalThis.DormPageCurl = (() => {
  const BANDS = 48;
  const ease = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  function clonePage(page, width, height) {
    const copy = page.cloneNode(true);
    copy.classList.add("curl-page-snapshot");
    copy.style.width = `${width}px`;
    copy.style.height = `${height}px`;
    copy.style.minHeight = "0";
    if (page.isConnected) copy.style.padding = getComputedStyle(page).padding;
    copy.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
    copy.querySelectorAll("img").forEach(e => { e.loading = "eager"; });
    copy.querySelectorAll("input,textarea,select").forEach((e, i) => {
      const original = page.querySelectorAll("input,textarea,select")[i];
      e.value = original?.value || "";
    });
    return copy;
  }
  function create({ book, front, back, forward, complete }) {
    const sourceRect = front.getBoundingClientRect();
    const width = front.offsetWidth, height = front.offsetHeight;
    const bookWidth = book.offsetWidth;
    const step = width / BANDS;
    const originX = forward ? front.offsetLeft : front.offsetLeft + width;
    const originY = front.offsetTop;
    const sheet = document.createElement("div");
    sheet.className = "book-curl-sheet";
    sheet.setAttribute("aria-hidden", "true");
    sheet.inert = true;
    const shadow = document.createElement("div");
    shadow.className = "book-curl-shadow";
    shadow.style.height = `${height}px`;
    shadow.style.top = `${originY}px`;
    book.append(shadow, sheet);
    const frontMaster = clonePage(front, width, height);
    const backMaster = clonePage(back, width, height);
    const patches = [];
    for (let i = 0; i < BANDS; i++) {
      const patch = document.createElement("div");
      patch.className = "curl-band";
      patch.style.width = `${step + .55}px`;
      patch.style.height = `${height}px`;
      const faces = [];
      for (const [master, offset, className] of [[frontMaster, i * step, "curl-front"], [backMaster, (BANDS - 1 - i) * step, "curl-back"]]) {
        const face = document.createElement("div");
        face.className = `curl-face ${className}`;
        face.style.width = `${step + .55}px`;
        const content = master.cloneNode(true);
        content.style.left = `${-offset}px`;
        face.append(content);
        const lighting = document.createElement("div");
        lighting.className = "curl-light";
        face.append(lighting);
        patch.append(face);
        faces.push(lighting);
      }
      sheet.append(patch);
      patches.push({patch, faces});
    }
    let progress = 0, frame = 0, disposed = false;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const setProgress = (value) => {
      if (disposed) return;
      progress = Math.max(0, Math.min(1, value));
      sheet.dataset.progress = progress.toFixed(3);
      const turn = Math.PI * progress;
      // A travelling cylindrical bend: curvature vanishes when a page lands.
      const bend = 1.22 * Math.sin(Math.PI * progress);
      let x = 0, z = 0;
      const positions = [{x:0,z:0}];
      const angles = [];
      for (let i = 0; i < BANDS; i++) {
        const u = (i + .5) / BANDS;
        const angle = turn + bend * (2 * u - 1);
        angles.push(angle);
        x += Math.cos(angle) * step;
        z += Math.sin(angle) * step;
        positions.push({x,z});
      }
      // Keep the whole sheet above the stationary spread, even near lift-off.
      const lift = 4 + Math.sin(Math.PI * progress) * 16;
      for (let i = 0; i < BANDS; i++) {
        const j = forward ? i : BANDS - 1 - i;
        const point = positions[forward ? j : j + 1];
        const angle = angles[j];
        const px = originX + (forward ? point.x : -point.x);
        const pz = Math.max(0, point.z) + lift;
        patches[i].patch.style.transform = `translate3d(${px}px,${originY}px,${pz}px) rotateY(${(forward ? -1 : 1) * angle}rad)`;
        const dark = .04 + .27 * Math.abs(Math.sin(angle));
        patches[i].faces[0].style.opacity = String(dark);
        patches[i].faces[1].style.opacity = String(dark * .75);
      }
      const projected = positions.map(point => originX + (forward ? point.x : -point.x));
      const left = Math.min(...projected), right = Math.max(...projected);
      shadow.style.left = `${Math.max(0, left - 18)}px`;
      shadow.style.width = `${Math.min(bookWidth, Math.max(35, right - left + 36))}px`;
      shadow.style.opacity = String(.48 * Math.sin(Math.PI * progress));
      shadow.style.filter = `blur(${4 + 16 * Math.sin(Math.PI * progress)}px)`;
      shadow.style.transform = `translateX(${(forward ? -1 : 1) * 10 * Math.sin(Math.PI * progress)}px)`;
    };
    const dispose = () => {
      disposed = true; cancelAnimationFrame(frame); sheet.remove(); shadow.remove();
    };
    const settle = (destination = 1) => {
      cancelAnimationFrame(frame);
      const from = progress;
      const duration = reduced.matches ? 0 : Math.max(260, 1250 * Math.abs(destination - from));
      let began;
      const tick = (time) => {
        if (disposed) return;
        began ??= time;
        const t = duration ? Math.min(1, (time - began) / duration) : 1;
        setProgress(from + (destination - from) * ease(t));
        if (t < 1) frame = requestAnimationFrame(tick);
        else {
          // Retain the flat backside for one paint before swapping live HTML.
          frame = requestAnimationFrame(() => { dispose(); complete(destination === 1); });
        }
      };
      frame = requestAnimationFrame(tick);
    };
    setProgress(0);
    return { setProgress, settle, cancel:dispose, sourceRect };
  }
  return {create};
})();
