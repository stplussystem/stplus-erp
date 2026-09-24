"use client";
import React, { useEffect, useRef } from "react";

// 🎨 พื้นหลังหน้า login — ตั้งค่าโดย Platform Admin ที่หน้า /company แท็บ "ตั้งค่าพื้นหลัง"
// (GET /api/login-background เป็น public) ใช้ทั้งบนหน้า login จริงและพรีวิวในหน้าตั้งค่า (inline = true → วาดในกรอบที่ครอบอยู่
// แทน fixed เต็มจอ)
export type LoginBackgroundConfig = {
  type: "none" | "image" | "video" | "preset" | "gradient";
  image_url?: string | null;
  video_url?: string | null;
  preset?: "aurora" | "waves" | "particles" | "bokeh" | string;
  color1?: string;
  color2?: string;
  gradient_animated?: boolean;
  overlay?: number;
};

export const LOGIN_BG_PRESETS: { key: string; label: string }[] = [
  { key: "aurora", label: "ออโรรา (กระแสสีไหล)" },
  { key: "waves", label: "คลื่น" },
  { key: "particles", label: "อนุภาคลอย" },
  { key: "bokeh", label: "โบเก้ (วงแสงเบลอ)" },
];

// keyframes ทั้งหมดอยู่ในไฟล์นี้ที่เดียว — ปิดอนิเมชันเมื่อผู้ใช้ตั้ง prefers-reduced-motion
const CSS = `
@keyframes lb-gradient { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
@keyframes lb-float1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(12vw,8vh) scale(1.25)} }
@keyframes lb-float2 { 0%,100%{transform:translate(0,0) scale(1.1)} 50%{transform:translate(-14vw,-6vh) scale(0.9)} }
@keyframes lb-float3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(6vw,-12vh) scale(1.3)} }
@keyframes lb-wave { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
@keyframes lb-rise { 0%{transform:translateY(20vh) scale(.8);opacity:0} 20%{opacity:.7} 100%{transform:translateY(-110vh) scale(1.3);opacity:0} }
@media (prefers-reduced-motion: reduce) { .lb-anim { animation: none !important; } }
`;

function Particles({ c1, c2 }: { c1: string; c2: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = canvas.clientWidth;
      h = canvas.height = canvas.clientHeight;
    };
    resize();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * (w || 800),
      y: Math.random() * (h || 600),
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: 1.5 + Math.random() * 2.5,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x;
          const dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.strokeStyle = `rgba(255,255,255,${0.25 * (1 - d / 110)})`;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return (
    <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      <canvas ref={ref} className="w-full h-full" />
    </div>
  );
}

export function LoginBackground({ config, inline = false }: { config: LoginBackgroundConfig | null; inline?: boolean }) {
  if (!config || config.type === "none") return null;
  const c1 = config.color1 || "#2563eb";
  const c2 = config.color2 || "#7c3aed";
  const overlay = Math.max(0, Math.min(80, Number(config.overlay ?? 0)));

  let layer: React.ReactNode = null;
  if (config.type === "image" && config.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    layer = <img src={config.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />;
  } else if (config.type === "video" && config.video_url) {
    layer = (
      <video
        src={config.video_url}
        className="absolute inset-0 w-full h-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
    );
  } else if (config.type === "gradient") {
    layer = (
      <div
        className="absolute inset-0 lb-anim"
        style={{
          background: `linear-gradient(120deg, ${c1}, ${c2}, ${c1})`,
          backgroundSize: config.gradient_animated === false ? "100% 100%" : "300% 300%",
          animation: config.gradient_animated === false ? undefined : "lb-gradient 12s ease infinite",
        }}
      />
    );
  } else if (config.type === "preset") {
    const p = config.preset || "aurora";
    if (p === "particles") {
      layer = <Particles c1={c1} c2={c2} />;
    } else if (p === "waves") {
      layer = (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(180deg, ${c1}, ${c2})` }}>
          {[0.18, 0.28, 0.4].map((o, i) => (
            <svg
              key={i}
              className="absolute bottom-0 left-0 lb-anim"
              style={{ width: "200%", height: `${45 + i * 8}%`, animation: `lb-wave ${14 + i * 6}s linear infinite ${i % 2 ? "reverse" : ""}` }}
              viewBox="0 0 1200 200"
              preserveAspectRatio="none"
            >
              <path
                d="M0,100 C150,20 350,180 600,100 C850,20 1050,180 1200,100 L1200,200 L0,200 Z"
                fill={`rgba(255,255,255,${o})`}
              />
            </svg>
          ))}
        </div>
      );
    } else if (p === "bokeh") {
      layer = (
        <div className="absolute inset-0 overflow-hidden" style={{ background: `linear-gradient(160deg, ${c1}, ${c2})` }}>
          {Array.from({ length: 14 }, (_, i) => (
            <span
              key={i}
              className="absolute rounded-full lb-anim"
              style={{
                left: `${(i * 37) % 100}%`,
                bottom: "-12vh",
                width: `${40 + ((i * 53) % 90)}px`,
                height: `${40 + ((i * 53) % 90)}px`,
                background: "rgba(255,255,255,0.35)",
                filter: "blur(6px)",
                animation: `lb-rise ${12 + (i % 6) * 3}s linear infinite`,
                animationDelay: `${-(i * 1.7)}s`,
              }}
            />
          ))}
        </div>
      );
    } else {
      // aurora
      layer = (
        <div className="absolute inset-0 overflow-hidden" style={{ background: "#0b1020" }}>
          <div className="absolute lb-anim rounded-full" style={{ width: "60vw", height: "60vw", left: "-10vw", top: "-15vw", background: c1, filter: "blur(90px)", opacity: 0.75, animation: "lb-float1 16s ease-in-out infinite" }} />
          <div className="absolute lb-anim rounded-full" style={{ width: "55vw", height: "55vw", right: "-12vw", top: "10vh", background: c2, filter: "blur(100px)", opacity: 0.7, animation: "lb-float2 20s ease-in-out infinite" }} />
          <div className="absolute lb-anim rounded-full" style={{ width: "45vw", height: "45vw", left: "25vw", bottom: "-20vw", background: "#06b6d4", filter: "blur(110px)", opacity: 0.45, animation: "lb-float3 24s ease-in-out infinite" }} />
        </div>
      );
    }
  }
  if (!layer) return null;

  return (
    <div className={`${inline ? "absolute" : "fixed"} inset-0 overflow-hidden pointer-events-none`} style={{ zIndex: 0 }} aria-hidden="true">
      <style>{CSS}</style>
      {layer}
      {overlay > 0 && <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${overlay / 100})` }} />}
    </div>
  );
}
