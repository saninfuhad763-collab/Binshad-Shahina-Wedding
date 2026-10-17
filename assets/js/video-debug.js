(() => {
  // Video Telemetry Diagnostic Module for Real-Device Testing
  // Activated ONLY when ?videoDebug=1 is present in the URL query string

  const isDebug = new URLSearchParams(window.location.search).has('videoDebug');
  if (!isDebug) return;

  console.log('[VideoDebug] Diagnostic mode active.');

  const sessionStartTime = performance.now();

  const report = {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight} @ DPR ${window.devicePixelRatio || 1}`,
    sessionStart: new Date().toISOString(),
    videos: {},
    events: [],
    revisitCycles: []
  };

  const vIds = [
    { id: 'storyMobileVideo1', name: 'Mobile Ch1 (Bride)', wrapperId: 'storyMobileMediaWrapper1' },
    { id: 'storyMobileVideo2', name: 'Mobile Ch2 (Groom)', wrapperId: 'storyMobileMediaWrapper2' },
    { id: 'storyMobileVideo3', name: 'Mobile Ch3 (Couple)', wrapperId: 'storyMobileMediaWrapper3' },
    { id: 'storyImg1', name: 'Desktop/Tablet Plate 1', wrapperId: 'storyVisualFrame' },
    { id: 'storyImg2', name: 'Desktop/Tablet Plate 2', wrapperId: 'storyVisualFrame' },
    { id: 'storyImg3', name: 'Desktop/Tablet Plate 3', wrapperId: 'storyVisualFrame' }
  ];

  vIds.forEach(item => {
    report.videos[item.id] = {
      name: item.name,
      observedDuration: null,
      posterAttr: null,
      initialReadyState: null,
      playCount: 0,
      endedCount: 0,
      lastEvent: 'initialized'
    };
  });

  function logDiagnosticEvent(videoId, eventType, extra = {}) {
    const now = performance.now();
    const relTimeMs = Math.round(now - sessionStartTime);
    const scrollY = Math.round(window.scrollY);

    const v = document.getElementById(videoId);
    const vState = v ? {
      currentTime: v.currentTime ? Number(v.currentTime.toFixed(3)) : 0,
      duration: v.duration ? Number(v.duration.toFixed(3)) : null,
      readyState: v.readyState,
      networkState: v.networkState,
      paused: v.paused,
      ended: v.ended,
      seeking: v.seeking,
      muted: v.muted
    } : null;

    const entry = {
      t: relTimeMs,
      scrollY,
      vId: videoId,
      evt: eventType,
      state: vState,
      ...extra
    };

    report.events.push(entry);

    if (report.videos[videoId]) {
      report.videos[videoId].lastEvent = `${eventType} @ ${vState?.currentTime || 0}s`;
      if (eventType === 'play') report.videos[videoId].playCount++;
      if (eventType === 'ended') report.videos[videoId].endedCount++;
      if (vState?.duration && !report.videos[videoId].observedDuration) {
        report.videos[videoId].observedDuration = vState.duration;
      }
    }

    updateHUD();
  }

  // 1. Attach Media Event Listeners when elements are ready
  function initVideoListeners() {
    vIds.forEach(item => {
      const v = document.getElementById(item.id);
      if (!v) return;

      report.videos[item.id].posterAttr = v.getAttribute('poster');
      report.videos[item.id].initialReadyState = v.readyState;

      const mediaEvents = [
        'loadstart', 'loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough',
        'play', 'playing', 'pause', 'ended', 'waiting', 'stalled', 'suspend',
        'seeking', 'seeked', 'emptied', 'error'
      ];

      mediaEvents.forEach(evtName => {
        v.addEventListener(evtName, () => {
          logDiagnosticEvent(item.id, evtName);
        }, { passive: true });
      });

      // Tap / click observer on container
      const wrapper = document.getElementById(item.wrapperId);
      if (wrapper) {
        wrapper.addEventListener('click', () => {
          logDiagnosticEvent(item.id, 'user_tap', {
            target: 'wrapper',
            wasPaused: v.paused
          });
        }, { passive: true });
      }
    });

    // 2. IntersectionObserver to detect offscreen scroll-out and viewport re-entry
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const vId = entry.target.id;
          const isVisible = entry.isIntersecting;
          const ratio = Number(entry.intersectionRatio.toFixed(2));

          logDiagnosticEvent(vId, isVisible ? 'viewport_enter' : 'viewport_exit', {
            ratio,
            boundingTop: Math.round(entry.boundingClientRect.top),
            boundingBottom: Math.round(entry.boundingClientRect.bottom)
          });
        });
      }, {
        threshold: [0, 0.25, 0.5, 0.75, 1.0]
      });

      vIds.forEach(item => {
        const v = document.getElementById(item.id);
        if (v) observer.observe(v);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initVideoListeners);
  } else {
    initVideoListeners();
  }

  // 3. Create Lightweight HUD Overlay
  const hud = document.createElement('div');
  hud.id = 'videoDebugHUD';
  hud.style.cssText = [
    'position: fixed',
    'bottom: 12px',
    'left: 12px',
    'right: 12px',
    'max-height: 240px',
    'background: rgba(14, 10, 11, 0.94)',
    'border: 1px solid rgba(226, 193, 151, 0.6)',
    'border-radius: 10px',
    'color: #e2c197',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
    'font-size: 11px',
    'line-height: 1.35',
    'padding: 10px 14px',
    'z-index: 999999',
    'box-shadow: 0 8px 32px rgba(0,0,0,0.75)',
    'box-sizing: border-box',
    'overflow-y: auto',
    '-webkit-overflow-scrolling: touch',
    'transition: max-height 0.25s ease'
  ].join(';');

  hud.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(226,193,151,0.25); padding-bottom:6px; margin-bottom:6px;">
      <span style="font-weight:700; letter-spacing:0.05em; color:#fff;">VIDEO TELEMETRY (?videoDebug=1)</span>
      <div style="display:flex; gap:6px;">
        <button id="copyVideoDebugBtn" style="background:#e2c197; color:#1a0810; border:none; border-radius:4px; padding:3px 8px; font-size:10px; font-weight:700; cursor:pointer;">Copy Report</button>
        <button id="toggleVideoDebugBtn" style="background:transparent; color:#e2c197; border:1px solid rgba(226,193,151,0.4); border-radius:4px; padding:3px 6px; font-size:10px; cursor:pointer;">Min</button>
      </div>
    </div>
    <div id="videoDebugStatus" style="font-size:10px; margin-bottom:6px; color:#d6c3ba;">Initializing...</div>
    <div id="videoDebugLog" style="font-size:9.5px; opacity:0.85; max-height:120px; overflow-y:auto; border-top:1px dashed rgba(226,193,151,0.15); padding-top:4px;"></div>
  `;

  document.body.appendChild(hud);

  let isMinimized = false;
  const toggleBtn = hud.querySelector('#toggleVideoDebugBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      isMinimized = !isMinimized;
      const statusDiv = hud.querySelector('#videoDebugStatus');
      const logDiv = hud.querySelector('#videoDebugLog');
      if (isMinimized) {
        hud.style.maxHeight = '42px';
        if (statusDiv) statusDiv.style.display = 'none';
        if (logDiv) logDiv.style.display = 'none';
        toggleBtn.textContent = 'Expand';
      } else {
        hud.style.maxHeight = '240px';
        if (statusDiv) statusDiv.style.display = 'block';
        if (logDiv) logDiv.style.display = 'block';
        toggleBtn.textContent = 'Min';
      }
    });
  }

  const copyBtn = hud.querySelector('#copyVideoDebugBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      try {
        const json = JSON.stringify(report, null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(json);
        } else {
          const ta = document.createElement('textarea');
          ta.value = json;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        copyBtn.textContent = 'COPIED!';
        copyBtn.style.background = '#88c999';
        setTimeout(() => {
          copyBtn.textContent = 'Copy Report';
          copyBtn.style.background = '#e2c197';
        }, 2000);
      } catch (err) {
        alert('Copy failed: ' + err.message);
      }
    });
  }

  function updateHUD() {
    const statusDiv = hud.querySelector('#videoDebugStatus');
    const logDiv = hud.querySelector('#videoDebugLog');
    if (!statusDiv) return;

    const m1 = report.videos['storyMobileVideo1'] || {};
    const m2 = report.videos['storyMobileVideo2'] || {};
    const m3 = report.videos['storyMobileVideo3'] || {};

    statusDiv.innerHTML = `
      <div><strong>Ch1:</strong> ${m1.lastEvent || 'idle'} | plays:${m1.playCount} ends:${m1.endedCount}</div>
      <div><strong>Ch2:</strong> ${m2.lastEvent || 'idle'} | plays:${m2.playCount} ends:${m2.endedCount}</div>
      <div><strong>Ch3:</strong> ${m3.lastEvent || 'idle'} | plays:${m3.playCount} ends:${m3.endedCount}</div>
      <div style="margin-top:2px; color:#aaa;">Total Events: ${report.events.length} | ScrollY: ${Math.round(window.scrollY)}px</div>
    `;

    if (logDiv) {
      const recent = report.events.slice(-5);
      logDiv.innerHTML = recent.map(e => `<div>+${e.t}ms [${e.vId.replace('storyMobileVideo', 'Ch')}] <strong>${e.evt}</strong> @ ${e.state?.currentTime || 0}s (y:${e.scrollY})</div>`).join('');
      logDiv.scrollTop = logDiv.scrollHeight;
    }
  }

  window.__videoTelemetryReport = report;
})();
