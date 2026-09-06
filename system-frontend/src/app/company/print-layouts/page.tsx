"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import {
  LayoutTemplate,
  ArrowLeft,
  Save,
  RefreshCw,
  FileText,
  XCircle,
  Loader2,
  Upload,
  X,
  Plus,
  Eye,
  EyeOff,
  Image as ImageIcon,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { getToken } from "@/lib/auth-storage";
import { cn } from "@/lib/utils";
import { AppLoading } from "@/components/ui/app-loading";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import {
  DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE,
  PRINT_PAGE_DIMENSIONS,
  PRINT_LAYOUT_GROUPS,
  PRINT_LAYOUT_SECTIONS,
  PrintLayoutBox,
  PrintLayoutConfig,
  PrintLayoutGroup,
  PaperSize,
  getRepeatableDateKeys,
  normalizeColumnGroups,
} from "@/lib/printLayoutDefaults";
import { HOLE_STRIP_WIDTH } from "@/lib/letterLayoutDefaults";

// 🖨️ ตั้งแต่ตอนนี้หน้านี้จัดวางได้ทั้ง 3 ขนาดกระดาษ (A4/Letter/Half Letter) เหมือน letter-layout/page.tsx —
// เก็บ layout/พื้นหลังอ้างอิงแยกเป็นคนละชุดต่อขนาดกระดาษ (ผู้ใช้อาจอยากให้แต่ละขนาดจัดวางไม่เหมือนกันก็ได้)
const PAPER_SIZES: { key: PaperSize; label: string }[] = [
  { key: "A4", label: "A4" },
  { key: "Letter", label: "Letter" },
  { key: "HalfLetter", label: "Half Letter" },
];

// สเกลแสดงผลบนจอ (612x792pt -> เต็มขนาด px) พิกัดที่เก็บ/บันทึกยังเป็น pt เดิมเสมอ
// 🔍 ซูมได้ตั้งแต่ 25%-200% ทีละ 10% — ตัวคูณ scale เปลี่ยนเป็น state (zoom) แทนค่าคงที่เดิม
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.1;
const MIN_WIDTH = 60;
const MIN_HEIGHT = 20;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

type DragMode = "move" | "resize";
type DragState = {
  key: string;
  mode: DragMode;
  startX: number;
  startY: number;
  startBox: PrintLayoutBox;
};

// ตัวอย่างรายการสินค้าและข้อมูลลูกค้าไว้ใช้กับทั้ง preview ตัวอย่าง PDF และ preview ในกล่องบน canvas
const SAMPLE_ITEMS = [
  { product_id: "1", product_name: "โคมไฟ LED PAR 64", sku: "LED-PAR64", quantity: 4, unit_name: "ชุด", unit_price: 850, discount_amount: 0, total_price: 3400 },
  { product_id: "2", product_name: "ลำโพง Line Array", sku: "SPK-LA200", quantity: 2, unit_name: "ตู้", unit_price: 4500, discount_amount: 500, total_price: 8500 },
];

// 🧾 ตัวอย่างตารางอ้างอิงใบกำกับภาษี — ใช้ตอน preview กลุ่ม "receipt" เท่านั้น (ตารางจริงของใบเสร็จเปลี่ยนเป็นตารางอ้างอิงแล้ว ไม่ใช่ตารางสินค้า)
const SAMPLE_INVOICE_REFS = [
  {
    document_number: "INV-2608-0001",
    issue_date: dayjs().subtract(10, "day").format("YYYY-MM-DD"),
    due_date: dayjs().add(20, "day").format("YYYY-MM-DD"),
    grand_total: 5000,
    outstanding_balance: 5000,
    payment_amount: 0,
  },
  {
    document_number: "INV-2608-0002",
    issue_date: dayjs().subtract(5, "day").format("YYYY-MM-DD"),
    due_date: dayjs().add(25, "day").format("YYYY-MM-DD"),
    grand_total: 3210.5,
    outstanding_balance: 1000,
    payment_amount: 2210.5,
  },
];

const buildSampleFormData = (group: PrintLayoutGroup) => ({
  document_type: group,
  document_number: group === "tax_invoice" ? "INV-2608-0000" : "RE-2608-0000",
  issue_date: dayjs().format("YYYY-MM-DD"),
  credit_days: 30,
  tax_type: "exclude",
  note: "ตัวอย่างการจัดวางเอกสาร",
  reference_number: "PO27-000000",
  transportation: "ขนส่งเอกชน",
  saleman_code: "SALE-01",
  deposit_amount: 0,
});

const EMPTY_GROUP_STRINGS = { tax_invoice: "", receipt: "" } as Record<PrintLayoutGroup, string>;

export default function PrintLayoutsEditorPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [fullDocumentSettings, setFullDocumentSettings] = useState<any>({});

  const [paperSize, setPaperSize] = useState<PaperSize>("Letter");
  const [activeGroup, setActiveGroup] = useState<PrintLayoutGroup>("tax_invoice");
  const [layouts, setLayouts] = useState<Record<PaperSize, Record<PrintLayoutGroup, PrintLayoutConfig>>>({
    Letter: { ...DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.Letter },
    A4: { ...DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.A4 },
    HalfLetter: { ...DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.HalfLetter },
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 🔍 ซูม canvas (25%-200%) และโหมดขยายเต็มจอ (overlay ทับหน้าเว็บ ไม่ใช่ browser Fullscreen API)
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🖼️ รูปถ่ายกระดาษหัวจดหมายตัวจริงของแต่ละกลุ่ม × แต่ละขนาดกระดาษ — ใช้เป็นพื้นหลังอ้างอิงบนหน้าจอเท่านั้น ไม่พิมพ์ลง PDF จริง
  const [backgroundPaths, setBackgroundPaths] = useState<Record<PaperSize, Record<PrintLayoutGroup, string>>>({
    Letter: { ...EMPTY_GROUP_STRINGS },
    A4: { ...EMPTY_GROUP_STRINGS },
    HalfLetter: { ...EMPTY_GROUP_STRINGS },
  });
  const [backgroundUrls, setBackgroundUrls] = useState<Record<PaperSize, Record<PrintLayoutGroup, string>>>({
    Letter: { ...EMPTY_GROUP_STRINGS },
    A4: { ...EMPTY_GROUP_STRINGS },
    HalfLetter: { ...EMPTY_GROUP_STRINGS },
  });
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [showBackground, setShowBackground] = useState(true);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const dragStateRef = useRef<DragState | null>(null);

  const getAuthHeader = () => {
    const token = getToken();
    return { Authorization: `Bearer ${token}`, Accept: "application/json" };
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

  // 🖨️ ขนาดหน้ากระดาษจริงที่ใช้คำนวณ/จำกัดขอบเขตการลาก-วาง เปลี่ยนไปตาม paperSize ที่เลือกอยู่ (3 ทาง)
  const PAGE_WIDTH = PRINT_PAGE_DIMENSIONS[paperSize].width;
  const PAGE_HEIGHT = PRINT_PAGE_DIMENSIONS[paperSize].height;

  // 🧩 กล่องคอลัมน์ตาราง/วันที่ซ้ำต้องถูก normalize (y/height ตรงกันในกลุ่มเดียวกันเสมอ) ก่อนนำไป render/แสดงในแถบด้านข้าง
  const layout = normalizeColumnGroups(layouts[paperSize][activeGroup], activeGroup);
  const sections = PRINT_LAYOUT_SECTIONS[activeGroup];
  const dateKeys = getRepeatableDateKeys(layout);
  const extraDateKeys = dateKeys.filter((k) => k !== "metaDate");

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/company`, { headers: getAuthHeader() });
      if (res.ok) {
        const result = await res.json();
        const data = Array.isArray(result) ? result[0] : result.data || result;
        if (data) {
          setCompanySettings(data);
          let parsed = data.document_settings;
          if (typeof parsed === "string") {
            try {
              parsed = JSON.parse(parsed);
            } catch (e) {}
          }
          setFullDocumentSettings(parsed || {});

          // 🧩 รวม default + ค่าที่บันทึกไว้จริงของแต่ละขนาดกระดาษ (Letter ยังอ่านจาก key เดิม print_layouts
          // เป๊ะ — ข้อมูลเก่าก่อนมี A4/Half Letter ถือเป็นของ Letter โดยปริยาย ไม่ migrate)
          const buildLayouts = (
            defaults: Record<PrintLayoutGroup, PrintLayoutConfig>,
            stored: any,
          ): Record<PrintLayoutGroup, PrintLayoutConfig> => ({
            tax_invoice: { ...defaults.tax_invoice, ...(stored?.tax_invoice?.sections || {}) },
            receipt: { ...defaults.receipt, ...(stored?.receipt?.sections || {}) },
          });
          setLayouts({
            Letter: buildLayouts(DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.Letter, parsed?.print_layouts),
            A4: buildLayouts(DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.A4, parsed?.print_layouts_a4),
            HalfLetter: buildLayouts(DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE.HalfLetter, parsed?.print_layouts_half_letter),
          });

          // 🧩 รูปพื้นหลังอ้างอิงก็แยกต่างหากคนละชุดตามขนาดกระดาษเช่นกัน
          const buildBackgrounds = (stored: any) => {
            const paths = { ...EMPTY_GROUP_STRINGS };
            const urls = { ...EMPTY_GROUP_STRINGS };
            (["tax_invoice", "receipt"] as PrintLayoutGroup[]).forEach((g) => {
              const p = stored?.[g]?.background_path;
              if (p) {
                paths[g] = p;
                urls[g] = `${apiUrl.replace("/api", "")}/storage/${p}`;
              }
            });
            return { paths, urls };
          };
          const letterBg = buildBackgrounds(parsed?.print_layouts);
          const a4Bg = buildBackgrounds(parsed?.print_layouts_a4);
          const halfLetterBg = buildBackgrounds(parsed?.print_layouts_half_letter);
          setBackgroundPaths({ Letter: letterBg.paths, A4: a4Bg.paths, HalfLetter: halfLetterBg.paths });
          setBackgroundUrls({ Letter: letterBg.urls, A4: a4Bg.urls, HalfLetter: halfLetterBg.urls });
        }
      } else {
        toast.error("โหลดข้อมูลบริษัทไม่สำเร็จ");
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const handleBackgroundSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingBackground(true);
    try {
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/print-layout-background/${activeGroup}/${paperSize}`, {
        method: "POST",
        headers: getAuthHeader(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setBackgroundPaths((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: result.path } }));
      setBackgroundUrls((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: result.url } }));
      setShowBackground(true);
      toast.success('อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด "บันทึกตำแหน่ง")');
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingBackground(false);
      if (backgroundInputRef.current) backgroundInputRef.current.value = "";
    }
  };

  const handleRemoveBackground = () => {
    setBackgroundPaths((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: "" } }));
    setBackgroundUrls((prev) => ({ ...prev, [paperSize]: { ...prev[paperSize], [activeGroup]: "" } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // 🧩 ทั้ง 2 กลุ่มเอกสาร (tax_invoice/receipt) รวมเป็น payload เดียวต่อขนาดกระดาษ ใช้ซ้ำได้ทั้ง 3 ขนาด
      const buildPayload = (paper: PaperSize) => ({
        tax_invoice: {
          sections: normalizeColumnGroups(layouts[paper].tax_invoice, "tax_invoice"),
          background_path: backgroundPaths[paper].tax_invoice || null,
        },
        receipt: {
          sections: normalizeColumnGroups(layouts[paper].receipt, "receipt"),
          background_path: backgroundPaths[paper].receipt || null,
        },
      });

      const formData = new FormData();
      formData.append("name", companySettings?.name || "");
      formData.append("tax_id", companySettings?.tax_id || "");
      formData.append("phone", companySettings?.phone || "");
      formData.append("address", companySettings?.address || "");
      formData.append(
        "document_settings",
        JSON.stringify({
          ...fullDocumentSettings,
          print_layouts: buildPayload("Letter"),
          print_layouts_a4: buildPayload("A4"),
          print_layouts_half_letter: buildPayload("HalfLetter"),
        }),
      );

      const res = await fetch(`${apiUrl}/company`, {
        method: "POST",
        headers: getAuthHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("บันทึกตำแหน่งจัดวางเอกสารสำเร็จ");
      } else {
        let errMsg = "Error 500";
        try {
          const err = await res.json();
          errMsg = err.message || "Unknown Error";
        } catch (e) {}
        toast.error(`บันทึกไม่สำเร็จ: ${errMsg}`);
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const executeReset = () => {
    setLayouts((prev) => ({
      ...prev,
      [paperSize]: { ...prev[paperSize], [activeGroup]: { ...DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE[paperSize][activeGroup] } },
    }));
    setSelectedKey(null);
    setIsResetOpen(false);
  };

  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } = await import("@/components/documents/SalesPdfTemplate");

      const subtotal = SAMPLE_ITEMS.reduce((s, i) => s + i.total_price, 0);
      const discount = SAMPLE_ITEMS.reduce((s, i) => s + i.discount_amount, 0);
      const vat_amount = subtotal * 0.07;

      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData: buildSampleFormData(activeGroup),
            selectedContact: {
              business_name: "บริษัท ตัวอย่าง จำกัด",
              address: "123 ถนนตัวอย่าง กรุงเทพฯ",
              tax_id: "0000000000000",
            },
            items: SAMPLE_ITEMS,
            invoiceRefs: activeGroup === "receipt" ? SAMPLE_INVOICE_REFS : undefined,
            finance: { subtotal, discount, vat_amount, grand_total: subtotal - discount + vat_amount },
            documentNumber: buildSampleFormData(activeGroup).document_number,
            printLayout: layout,
            paperSize,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  // 🖱️ ใช้ window-level listener แทนการพึ่ง setPointerCapture บนกล่องเดียว (pattern เดียวกับหน้า letter-layout เดิม)
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const dxPt = (e.clientX - drag.startX) / zoom;
      const dyPt = (e.clientY - drag.startY) / zoom;

      setLayouts((prevLayouts) => {
        const prevGroups = prevLayouts[paperSize];
        const prev = prevGroups[activeGroup];
        const box = prev[drag.key] || drag.startBox;
        const next = { ...box };
        if (drag.mode === "move") {
          next.x = clamp(drag.startBox.x + dxPt, 0, PAGE_WIDTH - box.width);
          next.y = clamp(drag.startBox.y + dyPt, 0, PAGE_HEIGHT - box.height);
        } else {
          next.width = clamp(drag.startBox.width + dxPt, MIN_WIDTH, PAGE_WIDTH - box.x);
          next.height = clamp(drag.startBox.height + dyPt, MIN_HEIGHT, PAGE_HEIGHT - box.y);
        }
        return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [drag.key]: next } } };
      });
    };
    const handleUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [activeGroup, zoom, paperSize, PAGE_WIDTH, PAGE_HEIGHT]);

  // ⌨️ กด Esc ปิดโหมดขยายเต็มจอ
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const zoomIn = () => setZoom((z) => Math.round(Math.min(ZOOM_MAX, z + ZOOM_STEP) * 100) / 100);
  const zoomOut = () => setZoom((z) => Math.round(Math.max(ZOOM_MIN, z - ZOOM_STEP) * 100) / 100);
  const zoomReset = () => setZoom(1);

  // 🖱️ Ctrl+scroll ซูมบน canvas — ไม่กด Ctrl ปล่อยให้ scroll ปกติ
  const handleCanvasWheel = (e: React.WheelEvent) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const startDrag = (e: React.PointerEvent, key: string, mode: DragMode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedKey(key);
    dragStateRef.current = {
      key,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startBox: { ...layout[key] },
    };
  };

  const updateSelectedBox = (field: keyof PrintLayoutBox, value: number) => {
    if (!selectedKey) return;
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const prev = prevGroups[activeGroup];
      const box = prev[selectedKey];
      if (!box) return prevLayouts;
      const next = { ...box, [field]: value };
      if (field === "x") next.x = clamp(value, 0, PAGE_WIDTH - next.width);
      if (field === "y") next.y = clamp(value, 0, PAGE_HEIGHT - next.height);
      if (field === "width") next.width = clamp(value, MIN_WIDTH, PAGE_WIDTH - next.x);
      if (field === "height") next.height = clamp(value, MIN_HEIGHT, PAGE_HEIGHT - next.y);
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [selectedKey]: next } } };
    });
  };

  const toggleVisible = (key: string) => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const prev = prevGroups[activeGroup];
      const box = prev[key];
      if (!box) return prevLayouts;
      return {
        ...prevLayouts,
        [paperSize]: { ...prevGroups, [activeGroup]: { ...prev, [key]: { ...box, visible: box.visible === false } } },
      };
    });
  };

  // 🧩 ปุ่ม "+ เพิ่มจุดวันที่" — เพิ่มกล่องวันที่ซ้ำใหม่ (metaDate_2, metaDate_3, ...) แสดงค่าวันที่เดียวกับกล่องหลักแค่คนละตำแหน่ง
  const addDateBox = () => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const current = prevGroups[activeGroup];
      const keys = getRepeatableDateKeys(current);
      const anchor = current[keys[0]] || current.metaDate;
      if (!anchor) return prevLayouts;
      const nextNum = keys.length + 1;
      const newKey = `metaDate_${nextNum}`;
      const newBox: PrintLayoutBox = {
        x: anchor.x,
        y: clamp(anchor.y + anchor.height + 4, 0, PAGE_HEIGHT - anchor.height),
        width: anchor.width,
        height: anchor.height,
        visible: true,
      };
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: { ...current, [newKey]: newBox } } };
    });
  };

  // ลบเฉพาะกล่องวันที่ที่เพิ่มเอง (กล่องหลัก metaDate ลบไม่ได้ เพราะอยู่ใน section list ตายตัว)
  const removeDateBox = (key: string) => {
    setLayouts((prevLayouts) => {
      const prevGroups = prevLayouts[paperSize];
      const current = { ...prevGroups[activeGroup] };
      delete current[key];
      return { ...prevLayouts, [paperSize]: { ...prevGroups, [activeGroup]: current } };
    });
    if (selectedKey === key) setSelectedKey(null);
  };

  const switchGroup = (group: PrintLayoutGroup) => {
    setActiveGroup(group);
    setSelectedKey(null);
  };

  const switchPaperSize = (size: PaperSize) => {
    setPaperSize(size);
    setSelectedKey(null);
  };

  if (loading) return <AppLoading text="กำลังโหลดข้อมูลการจัดวางเอกสาร..." />;

  const selectedBox = selectedKey ? layout[selectedKey] : null;
  const selectedLabel =
    sections.find((s) => s.key === selectedKey)?.label ||
    (selectedKey?.startsWith("metaDate_") ? `วันที่ (จุดเพิ่ม ${selectedKey.split("_")[1]})` : undefined);
  const backgroundUrl = backgroundUrls[paperSize][activeGroup];
  // 🕳️ แถบรูเจาะสายพานลำเลียง (sprocket hole strip) — แสดงเฉพาะกระดาษต่อเนื่อง (Letter/Half Letter) เท่านั้น
  // A4 เป็นกระดาษตัดมาตรฐาน ไม่มีรูเจาะ (pattern เดียวกับ letter-layout/page.tsx)
  const showHoles = paperSize === "Letter" || paperSize === "HalfLetter";
  const stripW = showHoles ? HOLE_STRIP_WIDTH : 0;

  // แถวหนึ่งใน "ส่วนประกอบเอกสาร" — ใช้ร่วมกันทั้ง section หลักและกล่องวันที่ที่เพิ่มเอง
  const SectionRow = ({ boxKey, label, removable }: { boxKey: string; label: string; removable?: boolean }) => {
    const isChecked = layout[boxKey]?.visible !== false;
    return (
      <div
        onClick={() => setSelectedKey(boxKey)}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer",
          selectedKey === boxKey ? "bg-blue-600 text-white" : "bg-muted/50 text-muted-foreground hover:bg-muted",
        )}
      >
        <input
          type="checkbox"
          checked={isChecked}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleVisible(boxKey)}
          className="w-4 h-4 rounded cursor-pointer accent-blue-600 shrink-0"
        />
        <span className={cn("flex-1 text-left", !isChecked && "opacity-50")}>
          {label}
          {!isChecked && " (ซ่อน)"}
        </span>
        {removable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeDateBox(boxKey);
            }}
            className={cn(
              "p-0.5 rounded shrink-0 cursor-pointer",
              selectedKey === boxKey ? "hover:bg-blue-700" : "hover:bg-muted",
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  };

  // กล่องหนึ่งกล่องบน canvas — ใช้ร่วมกันทั้ง section หลักและกล่องวันที่ที่เพิ่มเอง
  const CanvasBox = ({ boxKey, label }: { boxKey: string; label: string }) => {
    const box = layout[boxKey] || DEFAULT_PRINT_LAYOUTS_BY_PAPER_SIZE[paperSize][activeGroup][boxKey];
    if (!box) return null;
    const isSelected = selectedKey === boxKey;
    const isHidden = box.visible === false;
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          setSelectedKey(boxKey);
        }}
        onPointerDown={(e) => startDrag(e, boxKey, "move")}
        className={cn(
          "absolute border-2 rounded-md p-1.5 overflow-hidden cursor-move flex flex-col",
          isHidden
            ? "border-dashed border-border bg-muted/50 opacity-50"
            : isSelected
              ? "border-blue-500 bg-blue-50/70 z-10"
              : "border-blue-200 bg-blue-50/40 hover:border-blue-400",
        )}
        style={{
          left: box.x * zoom,
          top: box.y * zoom,
          width: box.width * zoom,
          height: box.height * zoom,
        }}
      >
        <span
          className={cn(
            "absolute -top-2.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold text-white",
            isHidden ? "bg-slate-400" : isSelected ? "bg-blue-600" : "bg-blue-400",
          )}
        >
          {label}
          {isHidden && " (ซ่อน)"}
        </span>
        <div className="flex-1 flex items-center overflow-hidden mt-1 w-full">
          <span className="text-[9px] text-muted-foreground leading-tight">{label}</span>
        </div>
        <div
          onPointerDown={(e) => startDrag(e, boxKey, "resize")}
          className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-blue-500 rounded-tl cursor-nwse-resize"
        />
      </div>
    );
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground pb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <LayoutTemplate className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ตั้งค่ากระดาษเอกสาร</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ใบกำกับภาษี / ใบเสร็จรับเงิน — แยกตำแหน่งอิสระต่อประเภทเอกสารและขนาดกระดาษ (ใบส่งสินค้าชั่วคราวย้ายไปตั้งค่าที่หน้า
              &quot;ตั้งค่าตำแหน่งพิมพ์ (Letter)&quot; แล้ว)
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* 🖨️ สลับขนาดกระดาษที่กำลังจัดวางอยู่ — A4/Letter/Half Letter คนละตำแหน่งกันได้ */}
          <div className="flex gap-1 p-1 bg-muted rounded-full">
            {PAPER_SIZES.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => switchPaperSize(p.key)}
                className={cn(
                  "h-8 px-4 rounded-full text-sm font-bold transition-all cursor-pointer",
                  paperSize === p.key ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ดูตัวอย่าง PDF
          </button>
          <AppTooltip label="รีเซ็ตเป็นค่าเริ่มต้น">
            <button
              type="button"
              onClick={() => setIsResetOpen(true)}
              className="flex items-center justify-center h-10 w-10 text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </AppTooltip>
          <AppTooltip label="ขยายเต็มจอ">
            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center h-10 w-10 text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-105"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </AppTooltip>
          <Link href="/company" className="w-full md:w-auto">
            <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
              <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
            </button>
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} บันทึกตำแหน่ง
          </button>
        </div>
      </div>

      {/* แท็บเลือกกลุ่มเอกสาร */}
      <div className="flex gap-2 mb-6">
        {PRINT_LAYOUT_GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => switchGroup(g.key)}
            className={cn(
              "h-10 px-5 rounded-full text-sm font-bold border transition-all cursor-pointer",
              activeGroup === g.key
                ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-600/20"
                : "bg-background text-muted-foreground border-border hover:bg-muted/50",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {isFullscreen && (
        <AppTooltip label="ปิดโหมดเต็มจอ (Esc)">
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="fixed top-4 right-4 z-[110] p-2.5 text-muted-foreground hover:text-red-500 bg-background hover:bg-red-50 rounded-full shadow-lg border border-border cursor-pointer transition-all"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        </AppTooltip>
      )}

      <div
        className={
          isFullscreen
            ? "fixed inset-0 z-[100] bg-background p-6 overflow-auto flex flex-col lg:flex-row gap-6 items-start"
            : "flex flex-col lg:flex-row gap-6 items-start"
        }
      >
        {/* ฝั่งซ้าย: ส่วนประกอบเอกสาร + ตัวเลขปรับตำแหน่ง + รูปพื้นหลังอ้างอิง — ไม่ scroll ในตัวเอง */}
        <div className="w-full lg:w-1/3 space-y-4">
          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="text-sm font-bold text-foreground mb-3">ส่วนประกอบเอกสาร</h3>
            <div className="space-y-1.5">
              {sections.map(({ key, label }) => (
                <React.Fragment key={key}>
                  <SectionRow boxKey={key} label={label} />
                  {key === "metaDate" && (
                    <>
                      {extraDateKeys.map((extraKey) => (
                        <SectionRow
                          key={extraKey}
                          boxKey={extraKey}
                          label={`วันที่ (จุดเพิ่ม ${extraKey.split("_")[1]})`}
                          removable
                        />
                      ))}
                      <button
                        type="button"
                        onClick={addDateBox}
                        className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> เพิ่มจุดวันที่
                      </button>
                    </>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {selectedBox && (
            <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
              <h3 className="text-sm font-bold text-foreground mb-3">{selectedLabel}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">ตำแหน่ง X (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.x)}
                    onChange={(e) => updateSelectedBox("x", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">ตำแหน่ง Y (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.y)}
                    onChange={(e) => updateSelectedBox("y", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">ความกว้าง (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.width)}
                    onChange={(e) => updateSelectedBox("width", Number(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">ความสูง (pt)</label>
                  <input
                    type="number"
                    className="w-full h-9 px-3 rounded-lg border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                    value={Math.round(selectedBox.height)}
                    onChange={(e) => updateSelectedBox("height", Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-card p-5 rounded-2xl shadow-sm border border-border">
            <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-blue-500" /> รูปพื้นหลังอ้างอิง
            </h3>
            <p className="text-[11px] text-muted-foreground mb-3">
              อัปโหลดรูปถ่ายกระดาษตัวจริงของ &quot;{PRINT_LAYOUT_GROUPS.find((g) => g.key === activeGroup)?.label}&quot; เพื่อช่วยจัดตำแหน่งบนจอเท่านั้น
              (ยืดรูปให้เต็มพื้นที่หน้ากระดาษ ไม่พิมพ์ลง PDF จริง)
            </p>
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => handleBackgroundSelect(e.target.files?.[0] || null)}
            />
            {backgroundUrl ? (
              <div className="flex items-center gap-2 flex-wrap">
                <img
                  src={backgroundUrl}
                  alt="รูปพื้นหลังอ้างอิง"
                  className="w-12 h-16 object-cover rounded-lg border border-border bg-background"
                />
                <button
                  type="button"
                  onClick={() => setShowBackground((v) => !v)}
                  className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer flex items-center gap-1.5"
                >
                  {showBackground ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showBackground ? "ซ่อนพื้นหลัง" : "แสดงพื้นหลัง"}
                </button>
                <button
                  type="button"
                  onClick={() => backgroundInputRef.current?.click()}
                  className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer"
                >
                  เปลี่ยนรูป
                </button>
                <AppTooltip label="ลบรูปพื้นหลัง">
                  <button
                    type="button"
                    onClick={handleRemoveBackground}
                    className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </AppTooltip>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => backgroundInputRef.current?.click()}
                disabled={uploadingBackground}
                className="w-full h-10 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {uploadingBackground ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                อัปโหลดรูปกระดาษตัวจริง
              </button>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-[11px] text-amber-700 leading-relaxed">
            เอกสารกลุ่มนี้พิมพ์เฉพาะข้อความลงบนกระดาษหัวจดหมายที่มีอยู่แล้ว — ระบบจะไม่วาดเส้นกรอบ/โลโก้ใดๆ ทับ
          </div>
        </div>

        {/* ฝั่งขวา: Canvas จำลองหน้ากระดาษ — scroll ได้เฉพาะโซนนี้ */}
        <div
          className={
            isFullscreen
              ? "w-full lg:w-2/3 bg-card p-6 rounded-2xl shadow-sm border border-border flex-1"
              : "w-full lg:w-2/3 bg-card p-6 rounded-2xl shadow-sm border border-border lg:sticky lg:top-4"
          }
        >
          {/* 🔍 แถบควบคุมซูม */}
          <div className="flex items-center justify-end gap-1.5 mb-3">
            <AppTooltip label="ซูมออก">
              <button
                type="button"
                onClick={zoomOut}
                className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
            </AppTooltip>
            <span className="text-xs font-bold text-muted-foreground w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <AppTooltip label="ซูมเข้า">
              <button
                type="button"
                onClick={zoomIn}
                className="p-2 text-muted-foreground hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </AppTooltip>
            <button
              type="button"
              onClick={zoomReset}
              className="h-8 px-3 rounded-xl border border-border bg-background text-xs font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer ml-1"
            >
              รีเซ็ต 100%
            </button>
          </div>
          <div
            className={cn(
              "rounded-xl bg-muted flex justify-center",
              isFullscreen ? "max-h-[calc(100vh-11rem)] overflow-auto p-4" : "max-h-[calc(100vh-180px)] overflow-auto p-4",
            )}
            onWheel={handleCanvasWheel}
          >
            {/* 🎨 พื้นหลังกล่อง scroll เป็นสีอ่อน (bg-muted) ตัดกับตัวกระดาษที่เป็นสีขาว ให้เห็นขอบเขตกระดาษชัดเจน
                🕳️ แถบรูเจาะสายพานลำเลียง (sprocket hole strip) — แสดงเฉพาะ Letter/Half Letter (กระดาษต่อเนื่อง
                จำลอง "กระดาษต่อเนื่อง" จริงตามภาพอ้างอิง: แถบขอบยื่นออกนอกขนาดเอกสารจริงข้างละ 0.5 นิ้ว
                (HOLE_STRIP_WIDTH) ทั้งซ้าย-ขวา — A4 (กระดาษตัดมาตรฐาน) ไม่แสดงรูเจาะ (stripW=0) */}
            <div
              className="relative bg-background shrink-0"
              style={{ width: (PAGE_WIDTH + stripW * 2) * zoom, height: PAGE_HEIGHT * zoom }}
            >
              {showHoles &&
                Array.from(
                  { length: Math.floor((PAGE_HEIGHT - 36) / 36) + 1 },
                  (_, i) => 18 + i * 36,
                ).map((y) => (
                  <React.Fragment key={y}>
                    <div
                      className="absolute rounded-full bg-muted border border-border shadow-inner pointer-events-none"
                      style={{
                        left: (stripW / 2 - 5) * zoom,
                        top: y * zoom - 5 * zoom,
                        width: 10 * zoom,
                        height: 10 * zoom,
                      }}
                    />
                    <div
                      className="absolute rounded-full bg-muted border border-border shadow-inner pointer-events-none"
                      style={{
                        left: (stripW + PAGE_WIDTH + stripW / 2 - 5) * zoom,
                        top: y * zoom - 5 * zoom,
                        width: 10 * zoom,
                        height: 10 * zoom,
                      }}
                    />
                  </React.Fragment>
                ))}

              <div
                className="absolute bg-card border border-border shadow-md select-none"
                style={{ left: stripW * zoom, top: 0, width: PAGE_WIDTH * zoom, height: PAGE_HEIGHT * zoom }}
                onClick={() => setSelectedKey(null)}
              >
                {backgroundUrl && showBackground && (
                  <img
                    src={backgroundUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full opacity-60 pointer-events-none"
                    style={{ objectFit: "fill" }}
                  />
                )}

                {sections.map(({ key, label }) => (
                  <React.Fragment key={key}>
                    <CanvasBox boxKey={key} label={label} />
                    {key === "metaDate" &&
                      extraDateKeys.map((extraKey) => (
                        <CanvasBox key={extraKey} boxKey={extraKey} label={`วันที่ (เพิ่ม ${extraKey.split("_")[1]})`} />
                      ))}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AppConfirmDialog
        open={isResetOpen}
        onOpenChange={setIsResetOpen}
        icon={AlertTriangle}
        iconColorClass="bg-orange-50 text-orange-600 border-orange-100/50"
        title="รีเซ็ตตำแหน่งจัดวาง?"
        description="ยืนยันรีเซ็ตตำแหน่งจัดวางของเอกสารกลุ่มนี้กลับเป็นค่าเริ่มต้นใช่หรือไม่?"
        confirmLabel="ยืนยันรีเซ็ต"
        confirmColorClass="bg-orange-500 hover:bg-orange-600 shadow-orange-500/20"
        onConfirm={executeReset}
      />

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe src={previewUrl} className="w-full h-full rounded-xl border border-border" title="PDF Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
