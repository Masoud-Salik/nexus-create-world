// Web Worker for background timer — system-clock based, drift-proof
let timerId = null;
let startTimestamp = 0;
let totalDuration = 0;

self.onmessage = (event) => {
  const { command, duration } = event.data;

  switch (command) {
    case 'start':
      totalDuration = duration;
      startTimestamp = Date.now();
      startTimer();
      break;

    case 'resume':
      totalDuration = duration;
      startTimestamp = Date.now();
      startTimer();
      break;

    case 'pause':
      clearInterval(timerId);
      timerId = null;
      break;

    case 'stop':
      clearInterval(timerId);
      timerId = null;
      totalDuration = 0;
      break;
  }
};

function startTimer() {
  if (timerId) clearInterval(timerId);

  // Send initial tick
  postMessage({ type: 'tick', timeLeft: totalDuration });

  timerId = setInterval(() => {
    // System-clock based: immune to interval throttling
    const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
    const remaining = Math.max(0, totalDuration - elapsed);

    postMessage({ type: 'tick', timeLeft: remaining });

    if (remaining <= 0) {
      clearInterval(timerId);
      timerId = null;
      postMessage({ type: 'finished' });
    }
  }, 250); // 250ms polling for snappier updates
}
