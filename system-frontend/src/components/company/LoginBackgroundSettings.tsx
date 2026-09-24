"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Video, Sparkles, Palette, Ban, Loader2, Save, Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth-storage";
import { AppLoading } from "@/components/ui/app-loading";
import {
  LoginBackground,
  LOGIN_BG_PRESETS,
  type LoginBackgroundConfig,
} from "@/components/auth/LoginBackground";

type BgType = "none" | "image" | "video" | "preset" | "gradient";

const TYPE_OPTIONS: { key: BgType; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "none", label: "ไม่ใช้", desc: "พื้นหลังเรียบตามธีมเดิม", icon: Ban },
  { key: "image", label: "รูปภาพ", desc: "jpg / png / webp / gif (GIF เคลื่อนไหวได้)", icon: ImageIcon },
  { key: "video", label: "วิดีโอวนลูป", desc: "mp4 / webm เล่นวนไม่มีเสียง", icon: Video },
  { key: "preset", label: "ภาพเคลื่อนไหวสำเร็จรูป", desc: "ออโรรา คลื่น อนุภาค โบเก้", icon: Sparkles },
  { key: "gradient", label: "สี / กระแสสี", desc: "เลือก 2 สี ไล่เฉด (เคลื่อนไหวได้)", icon: Palette },
];

const MAX_IMAGE_MB = 8;
const MAX_VIDEO_MB = 50;

// 🎨 แท็บ "ตั้งค่าพื้นหลัง" (หน้า /company) — ค่ากลางของทั้งระบบ เฉพาะ Platform Admin เท่านั้น
// เพราะหน้า login แสดงก่อนเลือกบริษัท (ดู LoginBackgroundController ฝั่ง backend)
export function LoginBackgroundSettings() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [type, setType] = useState<BgType>("none");
  const [preset, setPreset] = useState("aurora");
  const [color1, setColor1] = useState("#2563eb");
  const [color2, setColor2] = useState("#7c3aed");
  const [animated, setAnimated] = useState(true);
  const [overlay, setOverlay] = useState(30);

  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [savedVideoUrl, setSavedVideoUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [removeVideo, setRemoveVideo] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);

  const imagePreview = useMemo(() => (imageFile ? URL.createObjectURL(imageFile) : null), [imageFile]);
  const videoPreview = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); }, [videoPreview]);

  const authHeaders = { Authorization: `Bearer ${getToken()}`, Accept: "application/json" };

  const applyServer = (d: any) => {
    setType(d.type || "none");
    setPreset(d.preset || "aurora");
    setColor1(d.color1 || "#2563eb");
    setColor2(d.color2 || "#7c3aed");
    setAnimated(d.gradient_animated !== false);
    setOverlay(Number(d.overlay ?? 30));
    setSavedImageUrl(d.image_url || null);
    setSavedVideoUrl(d.video_url || null);
    setImageFile(null);
    setVideoFile(null);
    setRemoveImage(false);
    setRemoveVideo(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/settings/login-background`, { headers: authHeaders });
        if (res.status === 403) {
          setForbidden(true);
        } else if (res.ok) {
          applyServer(await res.json());
        } else {
          toast.error("โหลดการตั้งค่าพื้นหลังไม่สำเร็จ");
        }
      } catch {
        toast.error("เชื่อมต่อระบบไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentImage = removeImage ? null : imagePreview || savedImageUrl;
  const currentVideo = removeVideo ? null : videoPreview || savedVideoUrl;

  const previewConfig: LoginBackgroundConfig = {
    type,
    image_url: currentImage,
    video_url: currentVideo,
    preset,
    color1,
    color2,
    gradient_animated: animated,
    overlay,
  };

  const pickFile = (kind: "image" | "video", file: File | null) => {
    if (!file) return;
    const maxMb = kind === "image" ? MAX_IMAGE_MB : MAX_VIDEO_MB;
    const okType =
      kind === "image"
        ? /^image\/(jpeg|png|webp|gif)$/.test(file.type)
        : /^video\/(mp4|webm)$/.test(file.type);
    if (!okType) {
      setErrors((e) => ({ ...e, [kind]: kind === "image" ? "รองรับเฉพาะ jpg, png, webp, gif" : "รองรับเฉพาะ mp4, webm" }));
      return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      setErrors((e) => ({ ...e, [kind]: `ไฟล์ใหญ่เกิน ${maxMb} MB` }));
      return;
    }
    setErrors((e) => ({ ...e, [kind]: "" }));
    if (kind === "image") {
      setImageFile(file);
      setRemoveImage(false);
    } else {
      setVideoFile(file);
      setRemoveVideo(false);
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (type === "image" && !currentImage) next.image = "กรุณาอัปโหลดรูปภาพ";
    if (type === "video" && !currentVideo) next.video = "กรุณาอัปโหลดวิดีโอ";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("กำลังบันทึกการตั้งค่า...");
    try {
      const body = new FormData();
      body.append("type", type);
      body.append("preset", preset);
      body.append("color1", color1);
      body.append("color2", color2);
      body.append("gradient_animated", animated ? "1" : "0");
      body.append("overlay", String(overlay));
      if (imageFile) body.append("image", imageFile);
      if (videoFile) body.append("video", videoFile);
      if (removeImage && !imageFile) body.append("remove_image", "1");
      if (removeVideo && !videoFile) body.append("remove_video", "1");
      const res = await fetch(`${apiUrl}/settings/login-background`, { method: "POST", headers: authHeaders, body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstErr = data?.errors ? (Object.values(data.errors)[0] as string[])?.[0] : null;
        toast.error("บันทึกไม่สำเร็จ", { id: toastId, description: firstErr || data?.message });
        return;
      }
      toast.success("บันทึกการตั้งค่าพื้นหลังสำเร็จ", { id: toastId });
      applyServer(data);
    } catch {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AppLoading minHeight="min-h-[300px]" />;
  if (forbidden) {
    return (
      <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center text-muted-foreground text-sm">
        การตั้งค่านี้ใช้ได้เฉพาะ Platform Admin (เจ้าของระบบ) เท่านั้น
      </div>
    );
  }

  const colorInput = (label: string, value: string, set: (v: string) => void) => (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => set(e.target.value)}
          className="h-10 w-14 rounded-xl border border-border bg-background cursor-pointer p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set(e.target.value)}
          className="w-28 h-10 px-3 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm font-mono"
        />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      <div className="xl:col-span-3 bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="bg-muted text-foreground p-4 flex items-center gap-3">
          <ImageIcon className="w-5 h-5" />
          <h3 className="text-md font-bold leading-none">พื้นหลังหน้าเข้าสู่ระบบ</h3>
        </div>
        <div className="p-6 space-y-6">
          <p className="text-[11px] text-muted-foreground">
            ใช้กับหน้า login ของทุกบริษัทในระบบ (หน้า login แสดงก่อนเลือกบริษัท) — ตั้งค่าได้เฉพาะ Platform Admin
          </p>

          <div>
            <label className="block text-sm font-bold text-foreground mb-2">ชนิดพื้นหลัง</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TYPE_OPTIONS.map(({ key, label, desc, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setType(key);
                    setErrors({});
                  }}
                  className={cn(
                    "flex items-start gap-3 text-left p-3 rounded-xl border transition-all cursor-pointer",
                    type === key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 ring-2 ring-blue-100"
                      : "border-border hover:bg-muted/50",
                  )}
                >
                  <Icon className={cn("w-5 h-5 mt-0.5 shrink-0", type === key ? "text-blue-600" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-sm font-bold text-foreground">{label}</span>
                    <span className="block text-[11px] text-muted-foreground">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {type === "image" && (
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                รูปภาพ <span className="text-red-500">*</span>
              </label>
              <input
                ref={imageInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  pickFile("image", e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => imageInput.current?.click()}
                  className={cn(
                    "h-10 px-4 rounded-full border border-dashed text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors",
                    errors.image ? "border-red-500 text-red-600" : "border-blue-300 text-blue-600",
                  )}
                >
                  <Upload className="w-4 h-4" /> {currentImage ? "เปลี่ยนรูป" : "เลือกรูปภาพ"}
                </button>
                {currentImage && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentImage} alt="" className="h-10 w-16 object-cover rounded-lg border border-border" />
                    <button
                      type="button"
                      onClick={() => {
                        setImageFile(null);
                        setRemoveImage(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {errors.image && <p className="text-red-500 text-xs font-medium mt-1">{errors.image}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">ขนาดไม่เกิน {MAX_IMAGE_MB} MB — แนะนำภาพแนวนอน 1920×1080 ขึ้นไป</p>
            </div>
          )}

          {type === "video" && (
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                วิดีโอ <span className="text-red-500">*</span>
              </label>
              <input
                ref={videoInput}
                type="file"
                accept="video/mp4,video/webm"
                className="hidden"
                onChange={(e) => {
                  pickFile("video", e.target.files?.[0] || null);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => videoInput.current?.click()}
                  className={cn(
                    "h-10 px-4 rounded-full border border-dashed text-sm font-medium flex items-center gap-2 cursor-pointer hover:bg-blue-50 transition-colors",
                    errors.video ? "border-red-500 text-red-600" : "border-blue-300 text-blue-600",
                  )}
                >
                  <Upload className="w-4 h-4" /> {currentVideo ? "เปลี่ยนวิดีโอ" : "เลือกวิดีโอ"}
                </button>
                {currentVideo && (
                  <>
                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                      {videoFile ? videoFile.name : "วิดีโอที่ตั้งไว้แล้ว"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setVideoFile(null);
                        setRemoveVideo(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              {errors.video && <p className="text-red-500 text-xs font-medium mt-1">{errors.video}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">
                ขนาดไม่เกิน {MAX_VIDEO_MB} MB — เล่นวนอัตโนมัติแบบไม่มีเสียง แนะนำความยาว 10–30 วินาที ความละเอียด 1080p
              </p>
            </div>
          )}

          {type === "preset" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-foreground mb-2">แบบภาพเคลื่อนไหว</label>
                <div className="grid grid-cols-2 gap-2">
                  {LOGIN_BG_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPreset(p.key)}
                      className={cn(
                        "px-3 py-2.5 rounded-xl border text-sm font-medium text-left cursor-pointer transition-all",
                        preset === p.key
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600 ring-2 ring-blue-100"
                          : "border-border text-foreground hover:bg-muted/50",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                {colorInput("สีหลัก", color1, setColor1)}
                {colorInput("สีรอง", color2, setColor2)}
              </div>
            </div>
          )}

          {type === "gradient" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                {colorInput("สีที่ 1", color1, setColor1)}
                {colorInput("สีที่ 2", color2, setColor2)}
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={animated}
                  onChange={(e) => setAnimated(e.target.checked)}
                  className="w-4 h-4 rounded border-border"
                />
                ให้สีเคลื่อนไหวช้าๆ
              </label>
            </div>
          )}

          {type !== "none" && (
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                ความมืดของฟิล์มทับพื้นหลัง: {overlay}%
              </label>
              <input
                type="range"
                min={0}
                max={80}
                step={5}
                value={overlay}
                onChange={(e) => setOverlay(Number(e.target.value))}
                className="w-full max-w-sm accent-blue-600 cursor-pointer"
              />
              <p className="text-[11px] text-muted-foreground mt-1">เพิ่มเพื่อให้กล่อง login อ่านง่ายบนภาพที่สว่างหรือลายเยอะ</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      </div>

      <div className="xl:col-span-2 bg-card rounded-2xl shadow-sm border border-border overflow-hidden xl:sticky xl:top-4">
        <div className="bg-muted text-foreground p-4">
          <h3 className="text-md font-bold leading-none">ตัวอย่างหน้า login</h3>
        </div>
        <div className="p-4">
          <div className="relative aspect-video rounded-xl overflow-hidden border border-border bg-muted/50 flex items-center justify-center">
            <LoginBackground config={previewConfig} inline />
            <div className="relative z-10 w-40 rounded-2xl bg-white/90 backdrop-blur-md shadow-lg p-3 space-y-2">
              <div className="mx-auto w-8 h-8 rounded-full bg-blue-100" />
              <div className="h-4 rounded-full bg-slate-200" />
              <div className="h-4 rounded-full bg-slate-200" />
              <div className="h-5 rounded-full bg-blue-600" />
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">ตัวอย่างสดตามที่เลือก — ต้องกด &quot;บันทึกการตั้งค่า&quot; ก่อนจึงมีผลกับหน้า login จริง</p>
        </div>
      </div>
    </div>
  );
}
