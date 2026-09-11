"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Building2,
  Save,
  MapPin,
  Phone,
  CreditCard,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Building,
  Camera,
  Settings2,
  FileText,
  RefreshCw,
  X,
  LayoutTemplate,
  ArrowRight,
  FileImage,
  Upload,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AppLoading } from "@/components/ui/app-loading";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AppSelect } from "@/components/ui/app-select";
import { Switch } from "@/components/ui/switch";
import { getToken } from "@/lib/auth-storage";

// ประเภทเอกสารที่มีสวิตช์เลือกกระดาษ (A4/Letter/Half Letter) แยกอิสระต่อประเภท — ครบทั้ง 18 ประเภทแล้ว
// (เดิมมีแค่ 15 ยกเว้น stock_issue/stock_return/rental_stock_return ที่ไม่มีปุ่มพิมพ์ PDF — ตอนนี้เพิ่ม
// StockMovementPdfTemplate.tsx + ปุ่มดูตัวอย่างให้ทั้ง 3 ประเภทแล้ว จึงย้ายเข้ามาอยู่ในลิสต์นี้ได้)
// 🛡️ ซ่อนแถวที่เป็น key เก่าที่ตายแล้วออกจากตารางตั้งค่า (ไม่มีผลจริงกับระบบเลย แค่ตั้งค่าเผื่อไว้ไม่ได้ลบ data
// structure เดิมทิ้ง) — ผู้ใช้เคยสับสนว่า "ใบรับสินค้า" (receive_inventory, ไม่มีปุ่มเลือกกระดาษ) กับ
// "ใบรับสินค้า (Goods Receipt)" (goods_receipt, ใช้งานจริง) เป็นคนละแถวที่ชื่อคล้ายกันมาก
const HIDDEN_DOC_KEYS = ["receive_inventory"];

const PAPER_SIZE_DOC_TYPES = [
  "quotation",
  "billing_invoice",
  "tax_invoice",
  "cash",
  "receipt",
  "credit_note",
  "debit_note",
  "delivery_note",
  "invoice",
  "custom_quotation",
  "custom_cash",
  "stock_issue",
  "stock_return",
  "rental_stock_return",
  "purchase_order",
  "goods_receipt",
  "contractor_work_order",
  "receipt_voucher",
];

const DEFAULT_DOC_SETTINGS = {
  format: {
    datePattern: "YYMM",
    prefixSeparator: "-",
    dateSeparator: "-",
    digits: "4",
    companyPrefixEnabled: false,
    companyPrefixText: "",
  },
  docs: {
    quotation: { prefix: "QT", name: "ใบเสนอราคา", paperSize: "A4" },
    billing_invoice: {
      prefix: "BL",
      name: "ใบวางบิล/ใบแจ้งหนี้",
      paperSize: "A4",
    },
    tax_invoice: {
      prefix: "INV",
      name: "ใบกำกับภาษี/ใบแจ้งหนี้",
      paperSize: "A4",
    },
    cash: { prefix: "CA", name: "เงินสด", paperSize: "A4" },
    custom_quotation: {
      prefix: "CQT",
      name: "ใบเสนอราคา (กำหนดเอง)",
      paperSize: "A4",
    },
    custom_cash: {
      prefix: "CCS",
      name: "บิลเงินสด (กำหนดเอง)",
      paperSize: "A4",
    },
    receipt: { prefix: "RE", name: "ใบเสร็จรับเงิน", paperSize: "A4" },
    credit_note: { prefix: "CN", name: "ใบลดหนี้", paperSize: "A4" },
    debit_note: { prefix: "DN", name: "ใบเพิ่มหนี้", paperSize: "A4" },
    delivery_note: { prefix: "DO", name: "ใบส่งสินค้า", paperSize: "A4" },
    invoice: { prefix: "IVR", name: "ใบแจ้งหนี้", paperSize: "A4" },
    stock_issue: { prefix: "SI", name: "ใบเบิกสินค้า", paperSize: "A4" },
    stock_return: {
      prefix: "SR",
      name: "ใบคืนสินค้า (จากใบลดหนี้)",
      paperSize: "A4",
    },
    rental_stock_return: {
      prefix: "SR",
      name: "ใบคืนสินค้าเช่า",
      paperSize: "A4",
    },
    purchase_order: { prefix: "PO", name: "ใบสั่งซื้อ", paperSize: "A4" },
    // 🛡️ receive_inventory เป็น key เก่าที่ผิด (docKey จริงฝั่ง backend คือ goods_receipt) คงไว้เฉยๆ ไม่ลบ
    // (ตั้งค่า prefix ผ่าน key นี้ไม่เคยมีผลจริงมาก่อน) เพิ่ม goods_receipt key ที่ถูกต้องคู่กันแทน
    receive_inventory: { prefix: "RI", name: "ใบรับสินค้า" },
    goods_receipt: {
      prefix: "GR",
      name: "ใบรับสินค้า (Goods Receipt)",
      paperSize: "A4",
    },
    contractor_work_order: {
      prefix: "WO",
      name: "ใบสั่งซื้อ/ใบสั่งจ้าง (ผู้รับเหมา)",
      paperSize: "A4",
    },
    receipt_voucher: {
      prefix: "RV",
      name: "ใบสำคัญรับเงิน",
      paperSize: "A4",
    },
  },
};

export default function CompanyPage() {
  const [activeTab, setActiveTab] = useState("info");

  const getAuthHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    };
  };

  const getUploadHeader = () => {
    const token = getToken();
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    };
  };

  const [loadingCompany, setLoadingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  const [companyData, setCompanyData] = useState({
    name: "",
    tax_id: "",
    phone: "",
    address: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isDeleteLogoDialogOpen, setIsDeleteLogoDialogOpen] = useState(false);

  const [currentCompany, setCurrentCompany] = useState<any>(null);
  const [docSettings, setDocSettings] = useState<any>(DEFAULT_DOC_SETTINGS);
  // เก็บ document_settings ฉบับเต็มที่โหลดมา (เช่น letter_layout, letter_layout_background_path จากหน้าจัดวางเอกสาร Letter)
  // ไว้ merge กลับตอนบันทึก ไม่งั้นหน้านี้ (ที่รู้จักแค่ format/docs) จะเขียนทับ key อื่นๆ หายหมดทุกครั้งที่กดบันทึก
  const [rawDocumentSettings, setRawDocumentSettings] = useState<any>({});

  // 🎨 รูปกราฟิกพื้นหลังหัวกระดาษใบเสนอราคา (พิมพ์ลง PDF จริง — ฝั่งขวา ใต้ข้อความ "ใบเสนอราคา")
  const [quotationBgPath, setQuotationBgPath] = useState("");
  const [quotationBgUrl, setQuotationBgUrl] = useState("");
  const [uploadingQuotationBg, setUploadingQuotationBg] = useState(false);
  const quotationBgInputRef = useRef<HTMLInputElement>(null);

  // 🖼️ รูปพื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — คนละรูปกับพื้นหลังหัวกระดาษใบเสนอราคาด้านบน
  const [a4WatermarkPath, setA4WatermarkPath] = useState("");
  const [a4WatermarkUrl, setA4WatermarkUrl] = useState("");
  const [uploadingA4Watermark, setUploadingA4Watermark] = useState(false);
  const a4WatermarkInputRef = useRef<HTMLInputElement>(null);

  const fetchCompanyData = async () => {
    setLoadingCompany(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        headers: getAuthHeader(),
        cache: "no-store",
      });

      if (res.ok) {
        const result = await res.json();
        const data = Array.isArray(result) ? result[0] : result.data || result;

        if (data) {
          setCurrentCompany(data);
          setCompanyData({
            name: data.name || "",
            tax_id: data.tax_id || "",
            phone: data.phone || "",
            address: data.address || "",
          });
          setLogoPreview(data.logo || null);

          if (data.document_settings) {
            let parsed = data.document_settings;
            if (typeof parsed === "string") {
              try {
                parsed = JSON.parse(parsed);
              } catch (e) {}
            }
            setDocSettings({
              format: {
                ...DEFAULT_DOC_SETTINGS.format,
                ...(parsed?.format || {}),
              },
              docs: { ...DEFAULT_DOC_SETTINGS.docs, ...(parsed?.docs || {}) },
            });
            setRawDocumentSettings(parsed || {});
            if (parsed?.quotation_header_background_path) {
              setQuotationBgPath(parsed.quotation_header_background_path);
              setQuotationBgUrl(
                `${apiUrl.replace("/api", "")}/storage/${parsed.quotation_header_background_path}`,
              );
            }
            if (parsed?.a4_watermark_background_path) {
              setA4WatermarkPath(parsed.a4_watermark_background_path);
              setA4WatermarkUrl(
                `${apiUrl.replace("/api", "")}/storage/${parsed.a4_watermark_background_path}`,
              );
            }
          }
        }
      } else {
        let errMsg = "Error 500";
        try {
          const err = await res.json();
          errMsg = err.message || "Unknown Error";
        } catch (e) {
          errMsg = "ระบบหลังบ้านพังหนัก (ส่งกลับมาเป็น HTML)";
        }
        toast.error(`ดึงข้อมูลพัง: ${errMsg}`);
      }
    } catch (error) {
      console.error("Fetch company error:", error);
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setLoadingCompany(false);
    }
  };

  const handleSaveCompany = async () => {
    setSavingCompany(true);
    try {
      const formData = new FormData();
      formData.append("name", companyData.name);
      formData.append("tax_id", companyData.tax_id);
      formData.append("phone", companyData.phone);
      formData.append("address", companyData.address);
      formData.append(
        "document_settings",
        JSON.stringify({
          ...rawDocumentSettings,
          format: docSettings.format,
          docs: docSettings.docs,
        }),
      );

      if (logoFile) {
        formData.append("logo", logoFile);
      } else if (!logoPreview) {
        formData.append("remove_logo", "1");
      }

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        method: "POST",
        headers: getUploadHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("บันทึกข้อมูลบริษัทและตั้งค่าเรียบร้อย!");
        fetchCompanyData();
      } else {
        let errMsg = "Error 500";
        try {
          const err = await res.json();
          errMsg = err.message || "Unknown Error";
        } catch (e) {
          errMsg = "ระบบหลังบ้านพังหนัก (ส่งกลับมาเป็น HTML)";
        }
        toast.error(`บันทึกไม่ผ่าน: ${errMsg}`);
      }
    } catch (error) {
      toast.error("เชื่อมต่อระบบไม่สำเร็จ");
    } finally {
      setSavingCompany(false);
    }
  };

  // 🚀 ฟังก์ชันสำหรับลบโลโก้ทันทีที่กด (ไม่ต้องรอกดบันทึก)
  const handleDeleteLogoInstant = async () => {
    const tId = toast.loading("กำลังลบโลโก้...");
    try {
      const formData = new FormData();
      formData.append("name", companyData.name);
      formData.append("tax_id", companyData.tax_id);
      formData.append("phone", companyData.phone);
      formData.append("address", companyData.address);
      formData.append(
        "document_settings",
        JSON.stringify({
          ...rawDocumentSettings,
          format: docSettings.format,
          docs: docSettings.docs,
        }),
      );
      formData.append("remove_logo", "1");

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        method: "POST",
        headers: getUploadHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("ลบโลโก้บริษัทสำเร็จ!", { id: tId });
        setLogoPreview(null);
        setLogoFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsDeleteLogoDialogOpen(false); // 🚀 สั่งปิด Popup เมื่อลบเสร็จ
      } else {
        toast.error("ลบโลโก้ไม่สำเร็จ", { id: tId });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: tId });
    }
  };

  // 🚀 ฟังก์ชันอัปโหลดและบันทึกโลโก้ทันทีที่เลือกไฟล์
  const handleUploadLogoInstant = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 1. เช็คขนาดไฟล์ (ไม่เกิน 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("ไฟล์รูปภาพมีขนาดใหญ่เกินไป", {
        description: "กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 2 MB",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // 2. โชว์รูป Preview ทันทีให้ผู้ใช้เห็นว่าหน้าตากำลังจะเปลี่ยน
    setLogoPreview(URL.createObjectURL(file));
    setLogoFile(file);

    // 3. ยิง API บันทึกทันที
    const tId = toast.loading("กำลังอัปโหลดและบันทึกโลโก้...");
    try {
      const formData = new FormData();
      // ส่งข้อมูลเดิมไปด้วยป้องกันข้อมูลอื่นหาย
      formData.append("name", companyData.name);
      formData.append("tax_id", companyData.tax_id);
      formData.append("phone", companyData.phone);
      formData.append("address", companyData.address);
      formData.append(
        "document_settings",
        JSON.stringify({
          ...rawDocumentSettings,
          format: docSettings.format,
          docs: docSettings.docs,
        }),
      );
      formData.append("logo", file); // 🚀 แนบไฟล์ที่เพิ่งเลือกไป

      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/company`, {
        method: "POST",
        headers: getUploadHeader(),
        body: formData,
      });

      if (res.ok) {
        toast.success("เปลี่ยนโลโก้บริษัทสำเร็จ!", { id: tId });
        fetchCompanyData(); // รีเฟรชข้อมูลเบื้องหลังเพื่อให้ได้ URL จริงจากเซิร์ฟเวอร์
      } else {
        toast.error("อัปโหลดโลโก้ไม่สำเร็จ", { id: tId });
        setLogoPreview(currentCompany?.logo || null); // ย้อนรูปกลับถ้าเซิร์ฟเวอร์พัง
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: tId });
      setLogoPreview(currentCompany?.logo || null); // ย้อนรูปกลับถ้าเชื่อมต่อพัง
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""; // เคลียร์ input ให้พร้อมเลือกไฟล์ใหม่
    }
  };

  // 🎨 อัปโหลดรูปพื้นหลังหัวกระดาษใบเสนอราคา — ยิงทันทีที่เลือกไฟล์ (ตาม pattern เดียวกับหน้าจัดวางเอกสาร Letter)
  // ยังไม่บันทึกลง document_settings จนกว่าจะกด "บันทึก" ในแท็บนี้
  const handleQuotationBgSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingQuotationBg(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/quotation-header-background`, {
        method: "POST",
        headers: getUploadHeader(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setQuotationBgPath(result.path);
      setQuotationBgUrl(result.url);
      setRawDocumentSettings((prev: any) => ({
        ...prev,
        quotation_header_background_path: result.path,
      }));
      toast.success(
        'อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด "บันทึกพื้นหลังใบเสนอราคา")',
      );
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingQuotationBg(false);
      if (quotationBgInputRef.current) quotationBgInputRef.current.value = "";
    }
  };

  const handleQuotationBgRemove = () => {
    setQuotationBgPath("");
    setQuotationBgUrl("");
    setRawDocumentSettings((prev: any) => ({
      ...prev,
      quotation_header_background_path: null,
    }));
  };

  // 🖼️ อัปโหลดรูปพื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — คนละรูปกับพื้นหลังหัวกระดาษใบเสนอราคา
  // ยิงทันทีที่เลือกไฟล์ ยังไม่บันทึกลง document_settings จนกว่าจะกด "บันทึก" ในแท็บนี้ (pattern เดียวกับด้านบน)
  const handleA4WatermarkSelect = async (file: File | null) => {
    if (!file) return;
    setUploadingA4Watermark(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const body = new FormData();
      body.append("background", file);
      const res = await fetch(`${apiUrl}/company/a4-watermark-background`, {
        method: "POST",
        headers: getUploadHeader(),
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast.error(err?.message || "อัปโหลดรูปพื้นหลังไม่สำเร็จ");
        return;
      }
      const result = await res.json();
      setA4WatermarkPath(result.path);
      setA4WatermarkUrl(result.url);
      setRawDocumentSettings((prev: any) => ({
        ...prev,
        a4_watermark_background_path: result.path,
      }));
      toast.success(
        'อัปโหลดรูปพื้นหลังสำเร็จ (ยังไม่บันทึกจนกว่าจะกด "บันทึกพื้นหลัง A4")',
      );
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบขณะอัปโหลดรูปพื้นหลัง");
    } finally {
      setUploadingA4Watermark(false);
      if (a4WatermarkInputRef.current) a4WatermarkInputRef.current.value = "";
    }
  };

  const handleA4WatermarkRemove = () => {
    setA4WatermarkPath("");
    setA4WatermarkUrl("");
    setRawDocumentSettings((prev: any) => ({
      ...prev,
      a4_watermark_background_path: null,
    }));
  };

  const [departments, setDepartments] = useState([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [savingDept, setSavingDept] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [editingDeptId, setEditingDeptId] = useState<number | null>(null);

  // Popup ยืนยันการลบแผนก
  const [deleteDeptOpen, setDeleteDeptOpen] = useState(false);
  const [deletingDept, setDeletingDept] = useState(false);
  const [deptToDelete, setDeptToDelete] = useState<any>(null);

  const fetchDepts = async () => {
    setLoadingDepts(true);
    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/departments`, {
        headers: getAuthHeader(),
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
    } finally {
      setLoadingDepts(false);
    }
  };

  const handleDeptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDept(true); // 🚀 1. สั่งให้ปุ่มเริ่มหมุน!

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const method = editingDeptId ? "PUT" : "POST";
      const url = editingDeptId
        ? `${apiUrl}/departments/${editingDeptId}`
        : `${apiUrl}/departments`;

      const res = await fetch(url, {
        method,
        headers: getAuthHeader(),
        body: JSON.stringify({ name: deptName }),
      });

      if (res.ok) {
        toast.success(
          editingDeptId ? "อัปเดตแผนกเรียบร้อย" : "เพิ่มแผนกใหม่สำเร็จ",
        );
        setDeptName("");
        setEditingDeptId(null);
        setDeptOpen(false);
        fetchDepts();
      } else {
        toast.error("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSavingDept(false); // 🛑 2. บันทึกเสร็จ (หรือพัง) ก็สั่งหยุดหมุนเสมอ
    }
  };

  const handleDeleteDept = async () => {
    if (!deptToDelete?.id) return;

    setDeletingDept(true);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/departments/${deptToDelete.id}`, {
        method: "DELETE",
        headers: getAuthHeader(),
      });

      if (res.ok) {
        toast.success(`ลบแผนก \"${deptToDelete.name}\" เรียบร้อยแล้ว`);
        setDeleteDeptOpen(false);
        setDeptToDelete(null);
        fetchDepts();
      } else {
        let message = "ลบแผนกไม่สำเร็จ";

        try {
          const error = await res.json();
          message = error?.message || message;
        } catch {}

        toast.error(message);
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setDeletingDept(false);
    }
  };

  const getLivePreview = (prefix: string) => {
    const format = docSettings?.format || DEFAULT_DOC_SETTINGS.format;
    const {
      datePattern,
      prefixSeparator,
      dateSeparator,
      digits,
      companyPrefixEnabled,
      companyPrefixText,
    } = format;
    let datePart = "";
    if (datePattern === "YYYYMMDD") datePart = "20260502";
    else if (datePattern === "YYYYMM") datePart = "202605";
    else if (datePattern === "YYMM") datePart = "2605";
    else if (datePattern === "YYYY") datePart = "2026";

    const pSep = prefixSeparator === "none" ? "" : prefixSeparator;
    const dSep = dateSeparator === "none" ? "" : dateSeparator;
    const runNum = "1".padStart(Number(digits), "0");

    // 🏷️ ตัวย่อนำหน้าบริษัทเสริม (เช่น "ST") — ตั้งค่าเดียวใช้กับทุกประเภทเอกสารเหมือนกันหมด
    // 🩹 ถ้าตัวนำหน้าเอกสารเอง (prefix) ว่างเปล่า ไม่ต้องแปะ separator ต่อท้ายตัวย่อบริษัท (mirror ตรรกะเดียวกับ
    // DocumentService.php ฝั่ง backend กันเลขที่เอกสารมีขีดค้าง)
    const effectivePrefix =
      companyPrefixEnabled && companyPrefixText
        ? prefix
          ? `${companyPrefixText}${pSep}${prefix}`
          : companyPrefixText
        : prefix;

    if (datePart) {
      return effectivePrefix
        ? `${effectivePrefix}${pSep}${datePart}${dSep}${runNum}`
        : `${datePart}${dSep}${runNum}`;
    }
    return effectivePrefix ? `${effectivePrefix}${dSep}${runNum}` : runNum;
  };

  useEffect(() => {
    if (
      activeTab === "info" ||
      activeTab === "documents" ||
      activeTab === "quotationHeader"
    )
      fetchCompanyData();
    if (activeTab === "departments") fetchDepts();
  }, [activeTab]);

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground mx-auto space-y-6 antialiased">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
          <Building2 className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-md font-bold tracking-tight">
            จัดการข้อมูลบริษัท
          </h1>
          <p className="text-muted-foreground text-[11px] mt-0.5">
            จัดการข้อมูลองค์กร โครงสร้างแผนก และรูปแบบเลขรันเอกสารภายในระบบ
          </p>
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-muted dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("info")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "info"
              ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
              : "text-muted-foreground",
          )}
        >
          <Building className="w-4 h-4" /> ข้อมูลองค์กร
        </button>
        <button
          onClick={() => setActiveTab("departments")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "departments"
              ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
              : "text-muted-foreground",
          )}
        >
          <Building2 className="w-4 h-4" /> จัดการแผนก
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "documents"
              ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
              : "text-muted-foreground",
          )}
        >
          <FileText className="w-4 h-4" /> เลขรันเอกสาร
        </button>
        <button
          onClick={() => setActiveTab("documentLayout")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "documentLayout"
              ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
              : "text-muted-foreground",
          )}
        >
          <LayoutTemplate className="w-4 h-4" /> การจัดวางเอกสาร
        </button>
        <button
          onClick={() => setActiveTab("quotationHeader")}
          className={cn(
            "px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 cursor-pointer",
            activeTab === "quotationHeader"
              ? "bg-white dark:bg-slate-900 shadow-sm text-blue-600"
              : "text-muted-foreground",
          )}
        >
          <FileImage className="w-4 h-4" /> แก้ไขใบเสนอราคา
        </button>
      </div>

      {activeTab === "info" && (
        <Card className="rounded-xl border-none shadow-sm overflow-hidden relative p-0">
          {savingCompany && (
            <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 flex items-center justify-center z-50 backdrop-blur-sm">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
          )}

          <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
            <Building className="w-5 h-5 text-foreground" />
            <h3 className="text-md font-bold leading-none">
              รายละเอียดบริษัทหลัก
            </h3>
          </div>

          <CardContent className="p-8 relative z-1">
            {loadingCompany ? (
              <AppLoading minHeight="py-20" />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div className="p-4 lg:col-span-1 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-border dark:border-slate-800 pb-8 lg:pb-0 lg:pr-8">
                  <div
                    className="relative group cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {/* 🚀 ปุ่มกากบาทลบรูปลอยมุมขวาบน (เรียกฟังก์ชันลบทันที) */}
                    {logoPreview && (
                      <button
                        type="button"
                        className="absolute -top-3 -right-3 h-8 w-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer z-30 transition-transform active:scale-95"
                        onClick={(e) => {
                          e.stopPropagation(); // ดักไม่ให้เด้งเปิดเลือกไฟล์
                          setIsDeleteLogoDialogOpen(true); // 🚀 สั่งเปิด Popup สวยๆ แทน
                        }}
                        title="ลบโลโก้"
                      >
                        <X className="h-4 w-4 stroke-[3]" />
                      </button>
                    )}

                    <div className="w-48 h-48 rounded-3xl overflow-hidden border border-border dark:border-slate-800 shadow-sm bg-white flex items-center justify-center relative">
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          className="w-full h-full object-contain p-4 relative z-10"
                          alt="Company Logo"
                        />
                      ) : (
                        <div className="flex flex-col items-center text-muted-foreground relative z-10">
                          <Building className="w-12 h-12 mb-3 opacity-40" />
                          <span className="text-sm font-bold">
                            ยังไม่มีโลโก้
                          </span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2 z-20">
                        <Camera className="text-white w-8 h-8" />
                        <span className="text-white text-xs font-bold">
                          {logoPreview ? "เปลี่ยนโลโก้" : "อัปโหลดโลโก้"}
                        </span>
                      </div>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={handleUploadLogoInstant}
                    />
                  </div>
                  <div className="text-center mt-4 mb-8">
                    <p className="font-bold text-foreground dark:text-slate-200">
                      โลโก้บริษัท (หัวกระดาษ)
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      ขนาดแนะนำ 400x400 px ไฟล์ PNG หรือ JPG
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-2 flex flex-col justify-between h-full space-y-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-4 h-4 text-blue-600" />{" "}
                        ชื่อบริษัท
                      </label>
                      <Input
                        name="company_name"
                        autoComplete="organization"
                        value={companyData.name}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            name: e.target.value,
                          })
                        }
                        className="rounded-xl h-12 bg-white dark:bg-slate-900 border-border"
                        placeholder="ระบุชื่อบริษัท"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                          <CreditCard className="w-4 h-4 text-blue-600" />{" "}
                          เลขประจำตัวผู้เสียภาษี
                        </label>
                        <Input
                          name="tax_id"
                          autoComplete="off"
                          value={companyData.tax_id}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              tax_id: e.target.value,
                            })
                          }
                          className="rounded-xl h-12 bg-white dark:bg-slate-900 border-border"
                          placeholder="010XXXXXXXXXX"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4 text-blue-600" />{" "}
                          เบอร์โทรศัพท์ส่วนกลาง
                        </label>
                        <Input
                          name="phone"
                          autoComplete="tel"
                          value={companyData.phone}
                          onChange={(e) =>
                            setCompanyData({
                              ...companyData,
                              phone: e.target.value,
                            })
                          }
                          className="rounded-xl h-12 bg-white dark:bg-slate-900 border-border"
                          placeholder="02-XXX-XXXX"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 text-blue-600" />{" "}
                        ที่อยู่สำนักงาน
                      </label>
                      <Textarea
                        name="address"
                        autoComplete="street-address"
                        value={companyData.address}
                        onChange={(e) =>
                          setCompanyData({
                            ...companyData,
                            address: e.target.value,
                          })
                        }
                        className="rounded-xl min-h-[100px] bg-white dark:bg-slate-900 border-border leading-relaxed"
                        placeholder="บ้านเลขที่, ถนน, แขวง, เขต..."
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSaveCompany}
                      disabled={savingCompany || loadingCompany}
                      className="flex justify-center  h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                    >
                      {savingCompany ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      บันทึกข้อมูลบริษัท
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "departments" && (
        <Card className="rounded-xl border-none shadow-sm overflow-hidden relative p-0">
          {/* Header */}
          <div className="flex flex-col bg-muted p-2 text-foreground md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center p-2 gap-3">
              <Building2 className="w-5 h-5 shrink-0 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                โครงสร้างแผนกทั้งหมด
              </h3>
            </div>

            <Dialog
              open={deptOpen}
              onOpenChange={(v) => {
                setDeptOpen(v);
                if (!v) {
                  setDeptName("");
                  setEditingDeptId(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  type="button"
                  className="flex justify-center  h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform  disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  เพิ่มแผนกใหม่
                </Button>
              </DialogTrigger>

              <DialogContent className="rounded-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingDeptId ? "แก้ไขชื่อแผนก" : "สร้างแผนกใหม่"}
                  </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleDeptSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-muted-foreground">
                      ชื่อแผนก
                    </label>
                    <Input
                      value={deptName}
                      onChange={(e) => setDeptName(e.target.value)}
                      placeholder="เช่น ฝ่ายบุคคล, ฝ่ายขาย"
                      required
                      className="h-12 mt-2 rounded-xl"
                    />
                  </div>

                  <div className="flex justify-center pt-2">
                    <Button
                      type="submit"
                      disabled={savingDept}
                      className="flex justify-center  h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 hover:border-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all disabled:opacity-50"
                    >
                      {savingDept ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {savingDept ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Content */}
          <CardContent className="p-4 md:p-6">
            {loadingDepts ? (
              <AppLoading minHeight="py-20" />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <Table>
                  <TableHeader className="bg-muted/80 dark:bg-slate-800/50">
                    <TableRow className="border-b border-border hover:bg-transparent dark:border-slate-800">
                      <TableHead className="h-12 px-5 text-xs font-bold text-muted-foreground">
                        ชื่อแผนก
                      </TableHead>

                      <TableHead className="h-12 w-[220px] text-center text-xs font-bold text-muted-foreground">
                        จำนวนพนักงาน
                      </TableHead>

                      <TableHead className="h-12 w-[140px] px-5 text-right text-xs font-bold text-muted-foreground">
                        จัดการ
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {departments.length === 0 ? (
                      <TableRow className="border-0 hover:bg-transparent">
                        <TableCell colSpan={3} className="h-48 p-0">
                          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted dark:bg-slate-800">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-medium">
                              ยังไม่มีข้อมูล
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      departments.map((dept: any) => (
                        <TableRow
                          key={dept.id}
                          className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/70 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <TableCell className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
                                <Building2 className="h-4 w-4" />
                              </div>

                              <span className="font-semibold text-foreground dark:text-slate-200">
                                {dept.name}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="px-4 py-4 text-center">
                            <Badge
                              variant="secondary"
                              className="min-w-[72px] justify-center rounded-full px-3 py-1 font-medium"
                            >
                              {dept.users_count ?? 0} คน
                            </Badge>
                          </TableCell>

                          <TableCell className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="แก้ไขแผนก"
                                className="h-9 w-9 rounded-full text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-950/30 cursor-pointer"
                                onClick={() => {
                                  setEditingDeptId(dept.id);
                                  setDeptName(dept.name);
                                  setDeptOpen(true);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>

                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                title="ลบแผนก"
                                className="h-9 w-9 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 cursor-pointer"
                                onClick={() => {
                                  setDeptToDelete(dept);
                                  setDeleteDeptOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 🚀 TAB 3: เลขรันเอกสาร */}
      {activeTab === "documents" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <Settings2 className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                รูปแบบเลขรันสากล (Global Format)
              </h3>
            </div>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-muted-foreground uppercase">
                    1. รูปแบบวันที่
                  </label>
                  <AppSelect
                    value={docSettings?.format?.datePattern || "YYMM"}
                    onValueChange={(v) =>
                      setDocSettings({
                        ...docSettings,
                        format: {
                          ...(docSettings?.format || {}),
                          datePattern: v,
                        },
                      })
                    }
                    triggerClassName="h-12 rounded-xl w-60 p-4 mt-2"
                    options={[
                      { value: "none", label: "ไม่ระบุวันที่" },
                      { value: "YYYYMMDD", label: "YYYYMMDD (20260502)" },
                      { value: "YYYYMM", label: "YYYYMM (202605)" },
                      { value: "YYMM", label: "YYMM (2605)" },
                      { value: "YYYY", label: "YYYY (2026)" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-blue-600 uppercase">
                    2. ตัวคั่นหลังตัวย่อ (Prefix Sep)
                  </label>
                  <AppSelect
                    value={docSettings?.format?.prefixSeparator || "-"}
                    onValueChange={(v) =>
                      setDocSettings({
                        ...docSettings,
                        format: {
                          ...(docSettings?.format || {}),
                          prefixSeparator: v,
                        },
                      })
                    }
                    triggerClassName="h-12 rounded-xl border-blue-200 bg-blue-50/30 w-50 p-4 mt-2"
                    options={[
                      { value: "none", label: "ไม่มีตัวคั่น" },
                      { value: "-", label: "ขีดกลาง ( - )" },
                      { value: "/", label: "สแลช ( / )" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-amber-600">
                    3. ตัวคั่นหน้าเลขรัน (Date Sep)
                  </label>
                  <AppSelect
                    value={docSettings?.format?.dateSeparator || "-"}
                    onValueChange={(v) =>
                      setDocSettings({
                        ...docSettings,
                        format: {
                          ...(docSettings?.format || {}),
                          dateSeparator: v,
                        },
                      })
                    }
                    triggerClassName="h-12 rounded-xl border-amber-200 bg-amber-50/30 w-50 p-4 mt-2"
                    options={[
                      { value: "none", label: "ไม่มีตัวคั่น" },
                      { value: "-", label: "ขีดกลาง ( - )" },
                      { value: "/", label: "สแลช ( / )" },
                    ]}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[12px] font-bold text-muted-foreground">
                    4. จำนวนหลักตัวเลข
                  </label>
                  <AppSelect
                    value={docSettings?.format?.digits || "4"}
                    onValueChange={(v) =>
                      setDocSettings({
                        ...docSettings,
                        format: { ...(docSettings?.format || {}), digits: v },
                      })
                    }
                    triggerClassName="h-12 rounded-xl w-60 p-4 mt-2"
                    options={[
                      { value: "3", label: "3 หลัก (001)" },
                      { value: "4", label: "4 หลัก (0001)" },
                      { value: "5", label: "5 หลัก (00001)" },
                      { value: "6", label: "6 หลัก (000001)" },
                    ]}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <Tag className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                ตัวย่อนำหน้าเพิ่มเติม (Company Prefix)
              </h3>
            </div>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={!!docSettings?.format?.companyPrefixEnabled}
                    onCheckedChange={(checked) =>
                      setDocSettings({
                        ...docSettings,
                        format: {
                          ...(docSettings?.format || {}),
                          companyPrefixEnabled: checked,
                        },
                      })
                    }
                  />
                  <label className="text-sm font-bold text-foreground">
                    แสดงตัวย่อนำหน้าเพิ่มเติม
                  </label>
                </div>
                {docSettings?.format?.companyPrefixEnabled && (
                  <div className="flex items-center gap-3">
                    <Input
                      value={docSettings?.format?.companyPrefixText || ""}
                      onChange={(e) =>
                        setDocSettings({
                          ...docSettings,
                          format: {
                            ...(docSettings?.format || {}),
                            companyPrefixText: e.target.value.toUpperCase(),
                          },
                        })
                      }
                      placeholder="เช่น AB"
                      className="w-32 h-10 rounded-lg text-center font-bold uppercase text-blue-600 border-blue-200"
                    />
                    <span className="text-xs text-muted-foreground">ตัวอย่าง:</span>
                    <Badge
                      variant="outline"
                      className="text-sm font-mono px-4 py-1.5 bg-blue-50 text-blue-700 border-blue-100"
                    >
                      {getLivePreview(
                        docSettings?.docs?.quotation?.prefix || "QT",
                      )}
                    </Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0 relative">
            {savingCompany && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 flex items-center justify-center z-10 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            )}
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <FileText className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                กำหนดรหัสตัวนำหน้า (Prefix) และรูปแบบกระดาษ
              </h3>
            </div>
            <CardContent className="p-8 pt-2 relative z-1">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-[300px] py-4">
                      ประเภทเอกสาร
                    </TableHead>
                    <TableHead className="text-center">ตัวนำหน้า</TableHead>
                    <TableHead className="text-center">
                      ตัวอย่างเลขที่จะรัน
                    </TableHead>
                    <TableHead className="text-center">รูปแบบกระดาษ</TableHead>
                    <TableHead className="text-right px-8">การจัดการ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.keys(
                    docSettings?.docs || DEFAULT_DOC_SETTINGS.docs,
                  )
                    .filter((key) => !HIDDEN_DOC_KEYS.includes(key))
                    .map((key) => {
                    const doc =
                      docSettings?.docs?.[key] ||
                      DEFAULT_DOC_SETTINGS.docs[
                        key as keyof typeof DEFAULT_DOC_SETTINGS.docs
                      ];
                    return (
                      <TableRow
                        key={key}
                        className="hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-bold text-foreground py-4">
                          {doc.name}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            value={doc.prefix}
                            onChange={(e) => {
                              const newDocs = {
                                ...docSettings.docs,
                                [key]: {
                                  ...doc,
                                  prefix: e.target.value.toUpperCase(),
                                },
                              };
                              setDocSettings({ ...docSettings, docs: newDocs });
                            }}
                            className="w-24 mx-auto h-10 rounded-lg text-center font-bold uppercase text-blue-600 border-blue-200"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className="text-sm font-mono px-4 py-1.5 bg-blue-50 text-blue-700 border-blue-100"
                          >
                            {getLivePreview(doc.prefix)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {PAPER_SIZE_DOC_TYPES.includes(key) ? (
                            <div className="inline-flex gap-0.5 p-0.5 bg-muted rounded-full">
                              {(
                                [
                                  { key: "A4", label: "A4" },
                                  { key: "Letter", label: "Letter" },
                                  { key: "HalfLetter", label: "Half Letter" },
                                ] as const
                              ).map((p) => {
                                const isActive =
                                  p.key === "A4"
                                    ? doc.paperSize !== "Letter" && doc.paperSize !== "HalfLetter"
                                    : doc.paperSize === p.key;
                                return (
                                  <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => {
                                      const newDocs = {
                                        ...docSettings.docs,
                                        [key]: { ...doc, paperSize: p.key },
                                      };
                                      setDocSettings({ ...docSettings, docs: newDocs });
                                    }}
                                    className={cn(
                                      "h-7 px-3 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                                      isActive ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground",
                                    )}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right px-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // 🛡️ เดิมปุ่มนี้ไม่มี onClick เลย กดแล้วไม่ทำอะไร — รีเซ็ตตัวนำหน้าของแถวนี้กลับเป็นค่าเริ่มต้น
                              const defaultDoc =
                                DEFAULT_DOC_SETTINGS.docs[
                                  key as keyof typeof DEFAULT_DOC_SETTINGS.docs
                                ];
                              const newDocs = {
                                ...docSettings.docs,
                                [key]: { ...doc, prefix: defaultDoc.prefix },
                              };
                              setDocSettings({ ...docSettings, docs: newDocs });
                            }}
                            className="text-muted-foreground hover:text-blue-600 font-bold cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4 mr-2" /> รีเซ็ต
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="p-6 bg-muted/50 border-t flex justify-end">
                <Button
                  onClick={handleSaveCompany}
                  disabled={savingCompany}
                  className="flex justify-center  h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform  disabled:opacity-50"
                >
                  {savingCompany ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึกการตั้งค่าเอกสาร
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🚀 TAB (ใหม่): การจัดวางเอกสาร — แยกออกจากแท็บ "เลขรันเอกสาร" เดิม (เดิมปนอยู่กับตาราง prefix/paperSize) */}
      {activeTab === "documentLayout" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <LayoutTemplate className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                การจัดวางเอกสารขนาด Letter
              </h3>
            </div>
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                ปรับตำแหน่งและขนาดของแต่ละส่วนในเอกสาร (ชื่อเอกสาร,
                ข้อมูลลูกค้า, ตารางรายการ, สรุปยอด, ลายเซ็น ฯลฯ)
                แบบลาก-วางได้เอง สำหรับพิมพ์ทับกระดาษหัวจดหมายที่มีอยู่แล้ว —
                มี 2 แท็บแยกอิสระ: &quot;เอกสารทั่วไป&quot; (ใบเสนอราคา, ใบวางบิล,
                เงินสด, ใบลดหนี้, ใบเพิ่มหนี้) และ &quot;ใบส่งสินค้าชั่วคราว&quot;
                (ใบกำกับภาษี/ใบเสร็จ ตั้งค่าแยกที่การ์ดด้านล่าง)
              </p>
              <Link
                href="/company/letter-layout"
                className="w-full md:w-auto shrink-0"
              >
                <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                  จัดวางเอกสาร Letter <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0">
            <div className="bg-muted text-foreground p-4 flex items-center gap-3">
              <LayoutTemplate className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                ตั้งค่ากระดาษเอกสาร (ใบกำกับภาษี / ใบเสร็จ)
              </h3>
            </div>
            <CardContent className="p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground max-w-xl">
                ปรับตำแหน่งและขนาดของแต่ละส่วนแยกอิสระต่อประเภทเอกสาร —
                ใบกำกับภาษี/ใบส่งสินค้า และใบเสร็จรับเงิน
                พิมพ์เฉพาะข้อความลงกระดาษหัวจดหมายที่มีอยู่แล้ว (ใบส่งสินค้าชั่วคราว
                ย้ายไปตั้งค่าที่การ์ด &quot;การจัดวางเอกสารขนาด Letter&quot; ด้านบนแล้ว)
              </p>
              <Link
                href="/company/print-layouts"
                className="w-full md:w-auto shrink-0"
              >
                <button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform">
                  ตั้งค่ากระดาษเอกสาร <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 🚀 TAB 4: แก้ไขใบเสนอราคา (พื้นหลังหัวกระดาษ) */}
      {activeTab === "quotationHeader" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0 relative">
            {savingCompany && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 flex items-center justify-center z-10 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            )}
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <FileImage className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                พื้นหลังหัวกระดาษใบเสนอราคา
              </h3>
            </div>
            <CardContent className="p-8 relative z-1 space-y-4">
              <p className="text-sm text-muted-foreground max-w-2xl">
                อัปโหลดรูปกราฟิกที่ต้องการให้พิมพ์ลง PDF จริง
                แสดงเป็นพื้นหลังอยู่หลังข้อความ "ใบเสนอราคา (Quotation)"
                ที่หัวกระดาษฝั่งขวา — ใช้ค่าเดียวกับทุกใบเสนอราคาที่พิมพ์แบบ A4
              </p>
              <p className="text-xs text-muted-foreground max-w-2xl">
                ขนาดพื้นที่แสดงผลจริงในเอกสาร: กว้าง 220 x สูง 90 pt
                (อัตราส่วนประมาณ 22:9) — แนะนำให้เตรียมไฟล์รูปที่ความละเอียด 660
                x 270 พิกเซล ขึ้นไป (อัตราส่วนเดียวกัน) เพื่อความคมชัดตอนพิมพ์
                ระบบจะย่อ/ขยายรูปให้พอดีพื้นที่โดยคงสัดส่วนเดิม (ไม่ยืด/บีบภาพ)
              </p>
              <input
                ref={quotationBgInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
                onChange={(e) =>
                  handleQuotationBgSelect(e.target.files?.[0] || null)
                }
              />
              {quotationBgUrl ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <img
                    src={quotationBgUrl}
                    alt="พื้นหลังหัวกระดาษใบเสนอราคา"
                    className="w-32 h-20 object-contain rounded-lg border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => quotationBgInputRef.current?.click()}
                    className="h-10 px-4 rounded-xl border border-border bg-background text-sm font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer"
                  >
                    เปลี่ยนรูป
                  </button>
                  <button
                    type="button"
                    onClick={handleQuotationBgRemove}
                    className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                    title="ลบรูปพื้นหลัง"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => quotationBgInputRef.current?.click()}
                  disabled={uploadingQuotationBg}
                  className="h-10 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer disabled:opacity-50 w-fit"
                >
                  {uploadingQuotationBg ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  อัปโหลดรูปพื้นหลัง
                </button>
              )}
            </CardContent>
            <div className="p-6 bg-muted/50 border-t flex justify-end">
              <Button
                onClick={handleSaveCompany}
                disabled={savingCompany}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                {savingCompany ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                บันทึกพื้นหลังใบเสนอราคา
              </Button>
            </div>
          </Card>

          {/* 🖼️ พื้นหลังจางเต็มหน้า (watermark) ของเอกสารขาย A4 ทุกประเภท — คนละรูปกับพื้นหลังหัวกระดาษใบเสนอราคาด้านบน */}
          <Card className="rounded-xl border-none shadow-sm overflow-hidden p-0 relative">
            {savingCompany && (
              <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 flex items-center justify-center z-10 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            )}
            <div className="bg-muted text-foreground p-4 flex items-center gap-3 relative z-1">
              <FileImage className="w-5 h-5 text-foreground" />
              <h3 className="text-md font-bold leading-none">
                พื้นหลังจางเต็มหน้า (เอกสารขาย A4 ทุกประเภท)
              </h3>
            </div>
            <CardContent className="p-8 relative z-1 space-y-4">
              <p className="text-sm text-muted-foreground max-w-2xl">
                อัปโหลดรูปกราฟิกที่ต้องการให้แสดงเป็นพื้นหลังจางๆ กลางหน้ากระดาษ
                ของเอกสารขายทุกประเภทที่พิมพ์แบบ A4 (ใบเสนอราคา, ใบกำกับภาษี,
                ใบเสร็จ, ใบวางบิล, ใบแจ้งหนี้ ฯลฯ) — คนละรูปกับ
                "พื้นหลังหัวกระดาษใบเสนอราคา" ด้านบน
              </p>
              <p className="text-xs text-muted-foreground max-w-2xl">
                แนะนำไฟล์ PNG พื้นหลังโปร่งใส ความละเอียดสูง — ระบบจะปรับความกว้าง
                ให้พอดี 400pt โดยคงสัดส่วนเดิม (ไม่ยืด/บีบภาพ) และลดความทึบของรูป
                ลงอัตโนมัติให้จางพอเป็นพื้นหลัง ไม่บดบังเนื้อหาเอกสาร
              </p>
              <input
                ref={a4WatermarkInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp"
                className="hidden"
                onChange={(e) =>
                  handleA4WatermarkSelect(e.target.files?.[0] || null)
                }
              />
              {a4WatermarkUrl ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <img
                    src={a4WatermarkUrl}
                    alt="พื้นหลังจางเต็มหน้า A4"
                    className="w-32 h-20 object-contain rounded-lg border border-border bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => a4WatermarkInputRef.current?.click()}
                    className="h-10 px-4 rounded-xl border border-border bg-background text-sm font-bold text-muted-foreground hover:bg-muted/50 cursor-pointer"
                  >
                    เปลี่ยนรูป
                  </button>
                  <button
                    type="button"
                    onClick={handleA4WatermarkRemove}
                    className="p-2.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-xl cursor-pointer transition-colors"
                    title="ลบรูปพื้นหลัง"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => a4WatermarkInputRef.current?.click()}
                  disabled={uploadingA4Watermark}
                  className="h-10 px-4 rounded-xl border border-dashed border-blue-300 bg-blue-50/50 text-sm font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-2 cursor-pointer disabled:opacity-50 w-fit"
                >
                  {uploadingA4Watermark ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  อัปโหลดรูปพื้นหลัง
                </button>
              )}
            </CardContent>
            <div className="p-6 bg-muted/50 border-t flex justify-end">
              <Button
                onClick={handleSaveCompany}
                disabled={savingCompany}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                {savingCompany ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                บันทึกพื้นหลัง A4
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Dialog ยืนยันการลบแผนก */}
      <Dialog
        open={deleteDeptOpen}
        onOpenChange={(open) => {
          if (deletingDept) return;
          setDeleteDeptOpen(open);
          if (!open) setDeptToDelete(null);
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl border-0 bg-white p-8 text-center shadow-2xl dark:bg-slate-900 [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="mb-2 flex h-20 w-20 items-center justify-center rounded-full border-[6px] border-red-100/50 bg-red-50 text-red-500 dark:border-red-950/50 dark:bg-red-950/30">
              <Trash2 className="h-10 w-10" />
            </div>

            <DialogTitle className="text-2xl font-bold tracking-tight text-foreground dark:text-slate-100">
              ยืนยันการลบแผนก?
            </DialogTitle>

            <div className="space-y-2 px-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                คุณกำลังจะลบแผนก
              </p>

              <div className="rounded-xl bg-muted/50 px-4 py-3 dark:bg-slate-800/70">
                <p className="font-bold text-foreground dark:text-slate-100">
                  {deptToDelete?.name || "-"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  จำนวนพนักงาน {deptToDelete?.users_count ?? 0} คน
                </p>
              </div>

              <p className="text-xs font-medium text-red-500">
                เมื่อลบแล้วจะไม่สามารถย้อนกลับได้
              </p>
            </div>

            <div className="flex w-full justify-center gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={deletingDept}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => {
                  setDeleteDeptOpen(false);
                  setDeptToDelete(null);
                }}
              >
                ยกเลิก
              </Button>

              <Button
                type="button"
                disabled={deletingDept}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={handleDeleteDept}
              >
                {deletingDept ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังลบ...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    ยืนยันการลบ
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🚀 Dialog ยืนยันการลบโลโก้ (Popup สวยๆ) */}
      <Dialog
        open={isDeleteLogoDialogOpen}
        onOpenChange={setIsDeleteLogoDialogOpen}
      >
        <DialogContent className="max-w-sm rounded-3xl p-8 text-center bg-card border-0 shadow-2xl [&>button]:hidden">
          <div className="flex flex-col items-center justify-center space-y-4 pt-2">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-100/50">
              {/* ถ้า Error ไอคอน AlertTriangle ให้ import AlertTriangle จาก lucide-react เพิ่มด้านบนด้วยนะครับ */}
              <Trash2 className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              ยืนยันลบโลโก้?
            </DialogTitle>
            <p className="text-muted-foreground text-sm leading-relaxed px-4">
              คุณต้องการลบโลโก้บริษัทปัจจุบัน <br />
              และกลับไปใช้รูปเริ่มต้น (ตึก) ใช่หรือไม่?
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <Button
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setIsDeleteLogoDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={handleDeleteLogoInstant}
              >
                ยืนยันการลบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
