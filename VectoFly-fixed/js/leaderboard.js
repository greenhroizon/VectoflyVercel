(function () {
  var offset = 0,
    limit = 50,
    busy = false,
    my = "";
  try {
    my = JSON.parse(localStorage.getItem("vectofly_save_v1") || "{}").gk || "";
  } catch (e) {}
  var status = document.getElementById("boardStatus"),
    prev = document.getElementById("previous"),
    next = document.getElementById("next");
  async function load() {
    if (busy) return;
    busy = true;
    prev.disabled = next.disabled = true;
    status.textContent = "Loading global rankings…";
    try {
      var base = (window.VECTOFLY_CONFIG.API_URL || "").replace(/\/$/, "");
      var res = await fetch(
        base + "/api/scores?limit=" + limit + "&offset=" + offset,
        { cache: "no-store", signal: AbortSignal.timeout(12000) },
      );
      if (!res.ok) throw Error();
      var data = await res.json();
      var rows = document.getElementById("rankings");
      rows.textContent = "";
      data.scores.forEach(function (e, i) {
        var tr = document.createElement("tr");
        if (my && e.k === my) tr.className = "you";
        [
          e.r || offset + i + 1,
          e.n + (my && e.k === my ? " (you)" : ""),
          Number(e.s).toLocaleString(),
        ].forEach(function (v) {
          var td = document.createElement("td");
          td.textContent = v;
          tr.appendChild(td);
        });
        rows.appendChild(tr);
      });
      status.textContent = data.scores.length
        ? "Ranked players · " + data.total + " stored entries"
        : "No ranked scores yet. Take the first flight!";
      document.getElementById("pageNumber").textContent =
        "Page " + (offset / limit + 1);
      prev.disabled = offset === 0;
      next.disabled = !data.hasMore;
      if (window.vfTrack)
        vfTrack("leaderboard_visit", { page: offset / limit + 1 });
    } catch (e) {
      status.textContent =
        "Global rankings are unavailable. Please try again. Your local progress is safe.";
      prev.disabled = offset === 0;
    } finally {
      busy = false;
    }
  }
  prev.onclick = function () {
    offset = Math.max(0, offset - limit);
    load();
  };
  next.onclick = function () {
    offset += limit;
    load();
  };
  document.getElementById("retry").onclick = load;
  load();
})();
