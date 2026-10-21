(() => {
  // Motion Telemetry Diagnostic Module for Real-Device Testing
  // Activated ONLY when ?motionDebug=1 is present in the URL query string

  const isDebug = new URLSearchParams(window.location.search).has('motionDebug');
  if (!isDebug) return;

  console.log('[MotionDebug] Diagnostic mode active.');

  const report = {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight} @ DPR ${window.devicePixelRatio || 1}`,
    tapTime: 0,
    startTime: performance.now(),
    maxDelta: 0,
    totalFrames: 0,
    hitches25: 0,
    hitches33: 0,
    hitches50: 0,
    currentPhase: 'Idle (Awaiting Tap)',
    currentScale: 1.0,
    milestones: [],
    longTasks: [],
    frameDeltas: []
  };

  // 1. Long tasks observer if supported by browser engine
  let longTaskSupported = false;
  try {
    const po = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        const rel = report.tapTime ? Math.round(entry.startTime - report.tapTime) : Math.round(entry.startTime);
        report.longTasks.push({ rel, dur: Math.round(entry.duration) });
      }
    });
    po.observe({ entryTypes: ['longtask'] });
    longTaskSupported = true;
  } catch (e) {
    longTaskSupported = false;
  }

  // 2. Global telemetry hook for application milestones
  let firstFrameSeen = false;
  let samplingActive = false;
  let lastTime = performance.now();

  const telemetry = {
    start() {
      if (samplingActive) return;
      report.tapTime = performance.now();
      lastTime = performance.now();
      firstFrameSeen = false;
      samplingActive = true;
      report.milestones.push({ name: 'Opening Tap Registered', rel: 0 });
    },
    recordMilestone(name) {
      const now = performance.now();
      const rel = report.tapTime ? Math.round(now - report.tapTime) : 0;
      report.milestones.push({ name, rel });
      console.log(`[MotionDebug] Milestone: ${name} (+${rel}ms)`);
    },
    recordPhase(phaseName) {
      report.currentPhase = phaseName;
      const now = performance.now();
      const rel = report.tapTime ? Math.round(now - report.tapTime) : 0;
      report.milestones.push({ name: `Phase: ${phaseName}`, rel });
      console.log(`[MotionDebug] Phase Change: ${phaseName} (+${rel}ms)`);
    }
  };

  window.__motionTelemetry = telemetry;
  window.__perfRecorder = telemetry;

  // 3. Create Lightweight HUD Overlay
  const hud = document.createElement('div');
  hud.id = 'motionDebugHUD';
  hud.style.cssText = [
    'position: fixed',
    'bottom: 12px',
    'left: 12px',
    'right: 12px',
    'max-height: 250px',
    'background: rgba(14, 10, 11, 0.94)',
    'border: 1px solid rgba(226, 193, 151, 0.6)',
    'border-radius: 10px',
    'color: #e2c197',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
    'font-size: 11px',
    'line-height: 1.4',
    'padding: 10px 14px',
    'z-index: 999999',
    'box-shadow: 0 8px 32px rgba(0,0,0,0.7)',
    'pointer-events: none',
    'box-sizing: border-box',
    'overflow-y: auto',
    '-webkit-overflow-scrolling: touch'
  ].join(';');

  hud.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(226,193,151,0.25); padding-bottom:6px; margin-bottom:6px;">
      <span style="font-weight:700; letter-spacing:0.06em; color:#fff; font-size:11px;">MOTION TELEMETRY HUD</span>
      <button id="copyTelemetryBtn" style="pointer-events:auto; background:#4a101d; border:1px solid #e2c197; color:#fff; border-radius:5px; padding:4px 10px; font-size:10px; cursor:pointer; font-weight:600; touch-action:manipulation;">Copy Report</button>
    </div>
    <div id="hudPhase" style="color:#fff; font-weight:600; font-size:11px;">Phase: Idle (Awaiting Tap)</div>
    <div id="hudStats" style="display:flex; gap:12px; margin-top:4px; font-size:10px;">
      <span>Max: <b>0.0ms</b></span>
      <span>>25ms: 0</span>
      <span>>33ms: 0</span>
      <span>>50ms: 0</span>
    </div>
    <div id="hudMilestones" style="margin-top:6px; font-size:9.5px; opacity:0.9; max-height:85px; overflow-y:auto; line-height:1.35;">Waiting for user tap...</div>
  `;

  document.body ? document.body.appendChild(hud) : document.addEventListener('DOMContentLoaded', () => document.body.appendChild(hud));

  const copyBtn = hud.querySelector('#copyTelemetryBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const text = generateMarkdownReport();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => { copyBtn.textContent = 'Copy Report'; }, 2000);
        }).catch(() => {
          prompt('Copy telemetry report:', text);
        });
      } else {
        prompt('Copy telemetry report:', text);
      }
    });
  }

  function generateMarkdownReport() {
    return [
      '### Physical Device Motion Telemetry Report',
      `- **Device/UserAgent**: \`${report.userAgent}\``,
      `- **Viewport**: \`${report.viewport}\``,
      `- **Total Frames Sampled**: ${report.totalFrames}`,
      `- **Max Frame Interval**: **${report.maxDelta.toFixed(1)}ms**`,
      `- **Hitches > 25ms**: ${report.hitches25}`,
      `- **Hitches > 33ms**: ${report.hitches33}`,
      `- **Hitches > 50ms**: ${report.hitches50}`,
      `- **Long Tasks API**: ${longTaskSupported ? (report.longTasks.length > 0 ? report.longTasks.map(t => `+${t.rel}ms (${t.dur}ms)`).join(', ') : '0 detected') : 'Not supported on iOS WebKit'}`,
      '',
      '**Milestones Captured**:',
      report.milestones.map(m => `- \`+${m.rel}ms\`: ${m.name}`).join('\n') || '- None',
      '',
      '**Notable Frame Intervals (>25ms)**:',
      report.frameDeltas.filter(f => f.delta > 25).map(f => `- \`+${f.rel}ms\`: **${f.delta.toFixed(1)}ms** (scale: ${f.scale.toFixed(3)}x, ${f.phase})`).join('\n') || '- None (all frames <= 25ms)'
    ].join('\n');
  }

  // 4. Lightweight rAF measurement loop
  let heroImageEl = null;

  // Watch for button click fallback
  window.addEventListener('click', (e) => {
    if ((e.target.closest('#doorRoundBtn') || e.target.id === 'doorRoundBtn') && !samplingActive) {
      telemetry.start();
    }
  }, true);

  function rafLoop(now) {
    if (samplingActive) {
      if (!firstFrameSeen) {
        firstFrameSeen = true;
        lastTime = now;
        requestAnimationFrame(rafLoop);
        return;
      }

      const delta = now - lastTime;
      lastTime = now;
      report.totalFrames++;

      if (delta > report.maxDelta) report.maxDelta = delta;
      if (delta > 25) report.hitches25++;
      if (delta > 33) report.hitches33++;
      if (delta > 50) report.hitches50++;

      // Non-reflowing scale lookup
      if (!heroImageEl) heroImageEl = document.getElementById('heroCoupleImage');
      let scale = 1.0;
      if (window.gsap && heroImageEl) {
        scale = gsap.getProperty(heroImageEl, 'scale') || 1.0;
      }
      report.currentScale = scale;

      const rel = Math.round(now - report.tapTime);
      if (report.frameDeltas.length < 800) {
        report.frameDeltas.push({ rel, delta: Math.round(delta * 10) / 10, scale, phase: report.currentPhase });
      }
    } else {
      lastTime = now;
    }
    requestAnimationFrame(rafLoop);
  }
  requestAnimationFrame(rafLoop);

  // 5. Throttled UI updater (every 250ms, zero per-frame DOM updates)
  setInterval(() => {
    const phaseEl = document.getElementById('hudPhase');
    const statsEl = document.getElementById('hudStats');
    const mEl = document.getElementById('hudMilestones');

    if (phaseEl) {
      phaseEl.textContent = `Phase: ${report.currentPhase} | Scale: ${typeof report.currentScale === 'number' ? report.currentScale.toFixed(3) : report.currentScale}x`;
    }
    if (statsEl) {
      statsEl.innerHTML = `
        <span>Max: <b>${report.maxDelta.toFixed(1)}ms</b></span>
        <span style="color:${report.hitches25 > 0 ? '#ffb366' : '#e2c197'}">>25ms: <b>${report.hitches25}</b></span>
        <span style="color:${report.hitches33 > 0 ? '#ff8080' : '#e2c197'}">>33ms: <b>${report.hitches33}</b></span>
        <span style="color:${report.hitches50 > 0 ? '#ff3333' : '#e2c197'}">>50ms: <b>${report.hitches50}</b></span>
      `;
    }
    if (mEl && report.milestones.length > 0) {
      const recent = report.milestones.slice(-4);
      mEl.innerHTML = recent.map(m => `+${m.rel}ms: ${m.name}`).join('<br>');
    }
  }, 250);
})();
