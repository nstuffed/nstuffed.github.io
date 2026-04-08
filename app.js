document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("grid");
  const search = document.getElementById("search");
  const pathFilter = document.getElementById("path-filter");
  const genreFilter = document.getElementById("genre-filter");
  const durSlider = document.getElementById("dur-slider");
  const durValue = document.getElementById("dur-value");
  const themeToggle = document.getElementById("theme-toggle");
  const randomBtn = document.getElementById("random-btn");
  
  // Progress elements
  const progressContainer = document.getElementById("progress-container");
  const progressBarFill = document.getElementById("progress-bar-fill");
  const progressText = document.getElementById("progress-text");
  
  // Modal elements
  const modal = document.getElementById("modal");
  const closeModalBtn = document.getElementById("close-modal");
  const modalMovieName = document.getElementById("modal-movie-name");
  const modalSearchInput = document.getElementById("modal-search-input");
  const modalSearchBtn = document.getElementById("modal-search-btn");
  const modalResults = document.getElementById("modal-results");
  const infoModal = document.getElementById("info-modal");
  const closeInfoModalBtn = document.getElementById("close-info-modal");

  let movies = [];
  let currentEditKey = null;

  // Theme
  const savedTheme = localStorage.getItem("theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  async function load() {
    try {
      // Load unique paths for the dropdown
      const pathsRes = await fetch("/api/paths");
      const pathsData = await pathsRes.json();
      
      // Populate paths dropdown
      pathFilter.innerHTML = '<option value="">📁 Percorsi</option>';
      pathsData.paths.filter(p => p).forEach(p => {
        const opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p.length > 40 ? `.../${p.split("/").slice(-2).join("/")}` : p;
        opt.title = p;
        pathFilter.appendChild(opt);
      });

      // Load unique genres for the dropdown
      const genresRes = await fetch("/api/genres");
      const genresData = await genresRes.json();
      
      // Populate genres dropdown
      genreFilter.innerHTML = '<option value="">🎭 Generi</option>';
      genresData.genres.filter(g => g).forEach(g => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        genreFilter.appendChild(opt);
      });

      // Show progress bar and start polling
      progressContainer.classList.remove("hidden");
      startProgressPolling();

      const res = await fetch("/api/movies");
      const data = await res.json();
      movies = data.movies;
      applyFilters();
      
      // Hide progress bar after loading
      progressContainer.classList.add("hidden");
    } catch (e) {
      console.error("Load error:", e);
      grid.innerHTML = `<div class="loading">❌ Error: ${e.message}</div>`;
      progressContainer.classList.add("hidden");
    }
  }

  function startProgressPolling() {
    let pollingInterval;
    
    async function pollProgress() {
      try {
        const res = await fetch("/api/progress");
        const data = await res.json();
        
        if (data.status === "processing") {
          const progress = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
          progressBarFill.style.width = `${progress}%`;
          progressText.textContent = `${data.message} (${data.current}/${data.total})`;
        } else if (data.status === "completed") {
          progressBarFill.style.width = "100%";
          progressText.textContent = data.message;
          clearInterval(pollingInterval);
          setTimeout(() => {
            progressContainer.classList.add("hidden");
          }, 1000);
        }
      } catch (e) {
        console.error("Progress polling error:", e);
        clearInterval(pollingInterval);
      }
    }
    
    // Poll every 500ms
    pollingInterval = setInterval(pollProgress, 500);
  }

  function formatTime(min) {
    if (!min) return "?";
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}h ${m}m`;
  }

  function getDirectoryPath(m) {
    return (m.path || "").replace(/\\/g, "/").replace(/\/+$/, "");
  }

  function getFullPath(m) {
    const p = getDirectoryPath(m);
    const n = m.name || "";
    return p ? `${p}/${n}` : n;
  }

  function formatPathDisplay(fullPath) {
    if (!fullPath) return "";
    if (fullPath.length <= 40) return fullPath;
    const parts = fullPath.split("/");
    return `.../${parts.slice(-2).join("/")}`;
  }

  function render(list) {
    grid.innerHTML = "";
    if (list.length === 0) {
      grid.innerHTML = `<div class="loading">No results</div>`;
      return;
    }
    list.forEach(m => {
      const poster = m.poster 
        ? `<img src="${m.poster}" class="poster" alt="${m.title}" loading="lazy">` 
        : `<div class="poster no-poster">🎞️</div>`;
      
      const fullPath = getFullPath(m);
      grid.innerHTML += `
      <div class="card" data-name="${m.name}" data-year="${m.year}">
        ${poster}
        <button class="edit-btn" data-name="${m.name}" data-year="${m.year}">✏️</button>
        <div class="info">
          <div class="title">${m.tmdb_title || m.name}</div>
          <div class="meta">
            <span>${m.year} • ${formatTime(m.runtime)}</span>
            <span class="rating">⭐ ${m.rating || "N/A"}</span>
          </div>
          <div class="meta path-info" title="${fullPath}">📁 ${formatPathDisplay(fullPath)}</div>
          <div class="meta" style="margin-top:4px; font-size:0.75rem;">📅 ${m.time || ""}</div>
        </div>
      </div>
      `;
    });
  }

  function applyFilters() {
    const q = search.value.toLowerCase().trim();
    const pathQ = pathFilter.value;
    const genreQ = genreFilter.value;
    const maxD = parseInt(durSlider.value);
    durValue.textContent = maxD === 240 ? "All" : `${maxD} min`;

    const filtered = movies.filter(m => {
      const matchText = !q || (m.tmdb_title || m.name).toLowerCase().includes(q) || m.year.toString().includes(q);
      const matchPath = !pathQ || (m.path || "").toLowerCase() === pathQ.toLowerCase();
      const matchGenre = !genreQ || (m.genres || "").toLowerCase().includes(genreQ.toLowerCase());
      const runtime = m.runtime || 0;
      const matchDur = runtime === 0 || runtime <= maxD;
      return matchText && matchPath && matchGenre && matchDur;
    });
    render(filtered);
  }

  function openInfoModal(movie) {
    if (!movie) return;
    const posterLink = document.getElementById("info-poster-link");
    const posterImg = document.getElementById("info-poster-img");
    const posterPlace = document.getElementById("info-poster-placeholder");
    
    if (movie.poster) {
      posterImg.src = movie.poster;
      posterImg.style.display = "block";
      posterPlace.style.display = "none";
    } else {
      posterImg.style.display = "none";
      posterPlace.style.display = "flex";
    }

    document.getElementById("info-title").textContent = movie.tmdb_title || movie.name;
    document.getElementById("info-tmdb-title").textContent = movie.tmdb_title || "N/A";
    document.getElementById("info-release").textContent = movie.release_date || "N/A";
    document.getElementById("info-runtime").textContent = formatTime(movie.runtime);
    document.getElementById("info-rating").textContent = movie.rating ? `⭐ ${movie.rating}/10` : "N/A";
    document.getElementById("info-genres").textContent = movie.genres || "N/A";
    document.getElementById("info-popularity").textContent = movie.popularity || "N/A";

    document.getElementById("info-filename").textContent = movie.name || "N/A";
    const directoryPath = getDirectoryPath(movie);
    const pathEl = document.getElementById("info-path");
    pathEl.textContent = directoryPath || "N/A";
    pathEl.title = directoryPath || "";
    document.getElementById("info-time").textContent = movie.time || "N/A";

    const tmdbUrl = movie.tmdb_id ? `https://www.themoviedb.org/movie/${movie.tmdb_id}` : "";
    if (tmdbUrl) {
      posterLink.href = tmdbUrl;
      posterLink.classList.remove("disabled");
      posterLink.removeAttribute("aria-disabled");
      posterLink.title = "Open on TMDB";
    } else {
      posterLink.removeAttribute("href");
      posterLink.classList.add("disabled");
      posterLink.setAttribute("aria-disabled", "true");
      posterLink.title = "TMDB page not available";
    }

    document.getElementById("info-overview").textContent = movie.overview || "Plot not available.";
    infoModal.classList.remove("hidden");
  }

  function resetFilters() {
    search.value = "";
    pathFilter.value = "";
    genreFilter.value = "";
    durSlider.value = "240";
    applyFilters();
  }

  function getRandomMovie() {
    const q = search.value.toLowerCase().trim();
    const pathQ = pathFilter.value;
    const genreQ = genreFilter.value;
    const maxD = parseInt(durSlider.value);

    const filtered = movies.filter(m => {
      const matchText = !q || (m.tmdb_title || m.name).toLowerCase().includes(q) || m.year.toString().includes(q);
      const matchPath = !pathQ || (m.path || "").toLowerCase() === pathQ.toLowerCase();
      const matchGenre = !genreQ || (m.genres || "").toLowerCase().includes(genreQ.toLowerCase());
      const runtime = m.runtime || 0;
      const matchDur = runtime === 0 || runtime <= maxD;
      return matchText && matchPath && matchGenre && matchDur;
    });

    if (filtered.length === 0) {
      return null;
    }

    const randomIndex = Math.floor(Math.random() * filtered.length);
    return filtered[randomIndex];
  }

  search.addEventListener("input", applyFilters);
  pathFilter.addEventListener("change", applyFilters);
  genreFilter.addEventListener("change", applyFilters);
  durSlider.addEventListener("input", applyFilters);
  randomBtn.addEventListener("click", () => {
    const randomMovie = getRandomMovie();
    if (randomMovie) {
      openInfoModal(randomMovie);
    } else {
      alert("No movies available with current filters.");
    }
  });

  // Modal search
  async function searchModalResults(query) {
    if (!query || !query.trim()) {
      modalResults.innerHTML = `<div class="loading">Enter a title to search.</div>`;
      return;
    }
    const cleanQuery = query.trim();
    modalResults.innerHTML = `<div class="loading">Searching "${cleanQuery}"...</div>`;
    
    try {
      const url = `/api/tmdb/search?query=${encodeURIComponent(cleanQuery)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderModalResults(data.results);
    } catch (err) {
      modalResults.innerHTML = `<div class="loading" style="color:#ef4444">❌ Error: ${err.message}</div>`;
    }
  }

  function renderModalResults(results) {
    modalResults.innerHTML = "";
    if (!results || results.length === 0) {
      modalResults.innerHTML = `<div class="loading">No results. Try modifying the title.</div>`;
      return;
    }
    results.forEach(r => {
      const poster = r.poster ? `<img src="${r.poster}" alt="" loading="lazy">` : `<div style="height:180px; display:flex; align-items:center; justify-content:center; background:var(--border); color:var(--text-sec); font-size:2rem;">🎬</div>`;
      modalResults.innerHTML += `
        <div class="result-item" data-id="${r.id}">
          ${poster}
          <div class="res-title">${r.title}</div>
          <div class="res-meta">${r.year} • ⭐ ${r.rating}</div>
        </div>
      `;
    });
  }

  modalSearchBtn?.addEventListener("click", () => searchModalResults(modalSearchInput.value));
  modalSearchInput?.addEventListener("keydown", e => { if (e.key === "Enter") searchModalResults(modalSearchInput.value); });

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".edit-btn");
    if (btn) {
      currentEditKey = { name: btn.dataset.name, year: btn.dataset.year };
      modalMovieName.textContent = btn.dataset.name;
      modalSearchInput.value = btn.dataset.name;
      modal.classList.remove("hidden");
      setTimeout(() => modalSearchInput?.focus(), 100);
      await searchModalResults(btn.dataset.name);
      return;
    }

    const poster = e.target.closest(".poster");
    if (poster) {
      const card = poster.closest(".card");
      const name = card.dataset.name;
      const year = card.dataset.year;
      const movie = movies.find(m => m.name === name && m.year.toString() === year.toString());
      if (movie) openInfoModal(movie);
    }
  });

  closeInfoModalBtn?.addEventListener("click", () => infoModal.classList.add("hidden"));
  infoModal?.addEventListener("click", e => { if (e.target === infoModal) infoModal.classList.add("hidden"); });

  modalResults.addEventListener("click", async (e) => {
    const item = e.target.closest(".result-item");
    if (!item || !currentEditKey) return;
    const newId = item.dataset.id;
    item.style.pointerEvents = "none";
    item.innerHTML = `<div class="loading">✅ Updating...</div>`;
    try {
      const res = await fetch("/api/cache/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: currentEditKey.name, year: currentEditKey.year, tmdb_id: newId })
      });
      if (!res.ok) throw new Error("Update failed");
      const data = await res.json();
      const idx = movies.findIndex(m => m.name === currentEditKey.name && m.year === currentEditKey.year);
      if (idx !== -1) movies[idx] = { ...movies[idx], ...data.movie };
      applyFilters();
      closeModal();
    } catch (err) {
      item.innerHTML += `<br><span style="color:#ef4444; font-size:0.8rem;">❌ ${err.message}</span>`;
      item.style.pointerEvents = "auto";
    }
  });

  function closeModal() {
    modal.classList.add("hidden");
    currentEditKey = null;
    modalResults.innerHTML = "";
    if (modalSearchInput) modalSearchInput.value = "";
  }

  closeModalBtn?.addEventListener("click", closeModal);
  modal?.addEventListener("click", e => { if (e.target === modal) closeModal(); });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (!infoModal.classList.contains("hidden")) {
      e.preventDefault();
      infoModal.classList.add("hidden");
      return;
    }

    if (!modal.classList.contains("hidden")) {
      e.preventDefault();
      closeModal();
      return;
    }

    e.preventDefault();
    resetFilters();
  });

  load();
});