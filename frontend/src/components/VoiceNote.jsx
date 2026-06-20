import { useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const fmtTime = (s) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

// deterministic pseudo-waveform bar heights (15–100%) seeded by the message id,
// so the same voice note always renders the same shape
const barsFor = (seed) => {
  const s = String(seed || "x");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Array.from({ length: 34 }, (_, i) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return 15 + ((h >> (i % 11)) % 86);
  });
};

// Modern voice-note player: round play/pause control + tappable waveform with a
// played/unplayed split, adapting to the bubble it sits in (own vs incoming).
const VoiceNote = ({ src, seed, own }) => {
  const audioRef = useRef(null);
  const waveRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const bars = useMemo(() => barsFor(seed), [seed]);
  const progress = duration ? cur / duration : 0;

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  };

  const seek = (e) => {
    const a = audioRef.current;
    const el = waveRef.current;
    if (!a || !el || !duration) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
  };

  const filledColor = own ? "bg-primary-content" : "bg-primary";
  const emptyColor = own ? "bg-primary-content/35" : "bg-base-content/25";

  return (
    <div className="flex items-center gap-3 min-w-[210px] py-0.5">
      <button
        onClick={toggle}
        aria-label={playing ? "Pause" : "Play"}
        className={`size-9 rounded-full grid place-items-center shrink-0 ${
          own ? "bg-primary-content/20 text-primary-content" : "bg-primary text-primary-content"
        }`}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>

      <div
        ref={waveRef}
        onClick={seek}
        className="flex-1 flex items-center gap-[2px] h-8 cursor-pointer"
      >
        {bars.map((bh, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full transition-colors ${
              i / bars.length <= progress ? filledColor : emptyColor
            }`}
            style={{ height: `${bh}%` }}
          />
        ))}
      </div>

      <span className={`text-[11px] tabular-nums shrink-0 ${own ? "text-primary-content/80" : "opacity-60"}`}>
        {fmtTime(playing || cur ? cur : duration)}
      </span>

      <button
        onClick={cycleRate}
        aria-label="Playback speed"
        title="Playback speed"
        className={`text-[10px] font-semibold tabular-nums shrink-0 rounded-md px-1.5 py-0.5 leading-none ${
          own ? "bg-primary-content/20 text-primary-content" : "bg-base-content/10 text-base-content/70"
        }`}
      >
        {rate}x
      </button>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          e.currentTarget.playbackRate = rate;
        }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
      />
    </div>
  );
};

export default VoiceNote;
