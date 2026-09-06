"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Search,
  FileText,
  Filter,
  RefreshCw,
  Edit2,
  Printer,
  Download,
  Trash2,
  PackagePlus,
  Ellipsis,
  XCircle,
  FileSignature,
  Eye,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { getToken } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface PurchaseOrder {
  id: number;
  po_number: string;
  reference_number: string | null;
  status: string;
  expected_date: string | null;
  grand_total: number;
  contact: { name?: string; business_name?: string; tax_id?: string } | null;
  project_id: number | null;
  project: { name: string } | null;
  creator: { name: string } | null;
  created_at: string;
}

export default function PurchaseOrderListPage() {
  const router = useRouter();
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  
  // 🚀 แยก Filter วันที่เป็น เริ่มต้น และ สิ้นสุด
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [poToCancel, setPoToCancel] = useState<PurchaseOrder | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const userRole =
    typeof window !== "undefined"
      ? localStorage.getItem("role") || "admin"
      : "admin";

  const canApprove = usePermission("bt_approve_purchase");
  const canReceiveGoods = usePermission("bt_create_goods_receipt");

  useEffect(() => {
    fetchMasterData();
  }, []);

  // 🚀 รีเซ็ตหน้ากลับไปหน้าแรกเสมอถ้ามีการเปลี่ยน Filter ใดๆ
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterProject, filterDateFrom, filterDateTo]);

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [poRes, projRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/purchase-orders`, {
          headers,
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/projects`, { headers }).catch(
          () => null,
        ),
      ]);

      if (poRes.ok) {
        const poData = await poRes.json();
        setPos(Array.isArray(poData) ? poData : poData.data || []);
      }
      if (projRes && projRes.ok) {
        const projData = await projRes.json();
        setProjects(Array.isArray(projData) ? projData : projData.data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterProject("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCurrentPage(1);
  };

  const confirmDelete = async () => {
    if (!poToDelete) return;
    const toastId = toast.loading("กำลังลบข้อมูล...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (res.ok) {
        toast.success(`ลบเอกสาร ${poToDelete.po_number} สำเร็จ`, {
          id: toastId,
        });
        setPos(pos.filter((p) => p.id !== poToDelete.id));
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถลบข้อมูลได้", {
          id: toastId,
          description: err.message,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setIsDeleteDialogOpen(false);
      setPoToDelete(null);
    }
  };

  const confirmCancel = async () => {
    if (!poToCancel) return;
    const toastId = toast.loading("กำลังยกเลิกเอกสาร...");
    try {
      const token = getToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poToCancel.id}/cancel`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        }
      );

      if (res.ok) {
        toast.success(`ยกเลิกเอกสาร ${poToCancel.po_number} สำเร็จ`, {
          id: toastId,
        });
        setPos(
          pos.map((p) =>
            p.id === poToCancel.id ? { ...p, status: "Cancelled" } : p,
          )
        );
      } else {
        const err = await res.json();
        toast.error("ไม่สามารถยกเลิกเอกสารได้", {
          id: toastId,
          description: err.message,
        });
      }
    } catch (error) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ", { id: toastId });
    } finally {
      setIsCancelDialogOpen(false);
      setPoToCancel(null);
    }
  };

  const handleGeneratePDF = async (
    poId: number,
    action: "print" | "download" | "preview",
  ) => {
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [poRes, compRes, prodRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/purchase-orders/${poId}`, {
          headers,
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/company`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/products`, { headers }),
      ]);

      if (!poRes.ok) throw new Error("API Error");

      const poData = await poRes.json();
      const po = poData.data || poData;
      const compData = await compRes.json();
      const companySettings = Array.isArray(compData)
        ? compData[0]
        : compData.data || compData;
      const prodData = await prodRes.json();
      const products = Array.isArray(prodData) ? prodData : prodData.data || [];

      const items = po.items || [];

      // 🚀 บิลนี้ถูกบันทึกแล้ว (backend คำนวณ/ยืนยันตัวเลขไว้ตั้งแต่ตอนบันทึกแล้ว) — อ่านค่าที่บันทึกไว้ตรงๆ
      // ไม่คำนวณซ้ำจาก items เพื่อไม่ให้ตัวเลขใน PDF เพี้ยนไปจากที่บันทึกจริง (เช่น กรณีแก้ subtotal/VAT เอง)
      const subtotal = Number(po.subtotal || 0);
      const discount = Number(po.discount_amount || 0);
      const after_discount = Math.max(0, subtotal - discount);
      const vat_amount = Number(po.vat_amount || 0);
      const wht_amount = Number(po.wht_amount || 0);
      const grand_total = Number(po.grand_total || 0);

      const finance = {
        subtotal,
        discount,
        after_discount,
        vat_amount,
        wht_amount,
        grand_total,
        net_payable: grand_total - wht_amount,
      };

      let extractedNote = po.note || "";
      let extractedFooter = "**กรุณาแนบใบสั่งซื้อทุกครั้ง**";
      if (extractedNote.includes("[เงื่อนไขท้ายบิล]:")) {
        const parts = extractedNote.split("[เงื่อนไขท้ายบิล]:");
        extractedNote = parts[0].trim();
        extractedFooter = parts[1].trim();
      }

      const formData = {
        po_number: po.po_number,
        expected_date: po.expected_date,
        reference_number: po.reference_number,
        credit_days: po.credit_days || 0,
        note: extractedNote,
        creator: po.creator || null,
        approver: po.approver || null,
        created_at: po.created_at,
        updated_at: po.approved_at || po.updated_at,
      };

      const { pdf } = await import("@react-pdf/renderer");
      const { default: POPdfTemplate } =
        await import("@/components/documents/POPdfTemplate");

      const pdfDataObj = {
        companySettings,
        formData,
        selectedContact: po.contact,
        items,
        products,
        finance,
        poNumber: po.po_number,
        footerCondition: extractedFooter,
        ...getPaperSizeConfig(companySettings, "purchase_order"),
      };
      const blob = await pdf(<POPdfTemplate data={pdfDataObj} />).toBlob();
      const url = URL.createObjectURL(blob);
      toast.dismiss(toastId);

      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${po.po_number}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPreviewUrl(url);
      }
    } catch (error) {
      toast.error("สร้าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  const filteredPOs = pos.filter((po) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      (po.po_number || "").toLowerCase().includes(search) ||
      (po.reference_number || "").toLowerCase().includes(search) ||
      (po.contact?.business_name || po.contact?.name || "")
        .toLowerCase()
        .includes(search) ||
      (po.contact?.tax_id || "").toLowerCase().includes(search);

    const matchStatus = filterStatus === "all" || po.status === filterStatus;
    const matchProject =
      filterProject === "all" || String(po.project_id) === filterProject;
      
    // 🚀 ลอจิกการกรองช่วงวันที่ (เริ่ม-สิ้นสุด)
    const poDate = dayjs(po.created_at).format("YYYY-MM-DD");
    const matchDateFrom = !filterDateFrom || poDate >= filterDateFrom;
    const matchDateTo = !filterDateTo || poDate <= filterDateTo;

    return matchSearch && matchStatus && matchProject && matchDateFrom && matchDateTo;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredPOs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredPOs.length / itemsPerPage);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Pending":
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-600 rounded-full text-xs font-medium">
            รออนุมัติ
          </span>
        );
      case "Approved":
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
            อนุมัติแล้ว
          </span>
        );
      case "Partial":
        return (
          <span className="px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
            รับบางส่วน
          </span>
        );
      case "Completed":
        return (
          <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-xs font-medium">
            รับของแล้ว
          </span>
        );
      case "Cancelled":
        return (
          <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-xs font-medium">
            ยกเลิก
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ใบสั่งซื้อ (Purchase Orders)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              จัดการรายการสั่งซื้อสินค้าและติดตามสถานะการรับเข้าคลัง
            </p>
          </div>
        </div>
        <Link href="/purchase-orders/create">
          <button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
            <Plus className="w-4 h-4" /> <span>สร้างใบสั่งซื้อใหม่</span>
          </button>
        </Link>
      </div>

      <div className="bg-card rounded-t-xl border border-border border-b-0 print:hidden w-full">
        {/* ปรับเลย์เอาต์ช่องกรองเป็น 7 คอลัมน์เหมือนหน้า Goods Receipts */}
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 p-4 bg-slate-50/50 items-center w-full rounded-t-xl">
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ค้นหา (เลขที่, ชื่อ, Ref)..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <AppSelect
              value={filterStatus}
              onValueChange={setFilterStatus}
              triggerClassName="pl-10"
              options={[
                { value: "all", label: "สถานะทั้งหมด" },
                { value: "Pending", label: "รออนุมัติ (Pending)" },
                { value: "Approved", label: "อนุมัติแล้ว (Approved)" },
                { value: "Partial", label: "รับบางส่วน (Partial)" },
                { value: "Completed", label: "รับของแล้ว (Completed)" },
                { value: "Cancelled", label: "ยกเลิก (Cancelled)" },
              ]}
            />
          </div>
          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <AppSelect
              value={filterProject}
              onValueChange={setFilterProject}
              triggerClassName="pl-10"
              options={[
                { value: "all", label: "โครงการทั้งหมด" },
                ...projects.map((project) => ({
                  value: String(project.id),
                  label: project.name,
                })),
              ]}
            />
          </div>
          
          <div>
            <AppDatePicker
              value={filterDateFrom}
              onChange={setFilterDateFrom}
              placeholder="วันที่เริ่มต้น"
            />
          </div>

          <div>
            <AppDatePicker
              value={filterDateTo}
              onChange={setFilterDateTo}
              placeholder="วันที่สิ้นสุด"
            />
          </div>

          <button
            onClick={clearFilters}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> ล้างตัวกรอง
          </button>
        </div>
      </div>

      <div className="border border-border rounded-b-xl bg-card hide-scrollbar pb-12 min-h-[300px]">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-medium">เอกสาร / อ้างอิง</th>
              <th className="px-6 py-4 font-medium">ผู้จำหน่าย (Supplier)</th>
              <th className="px-6 py-4 font-medium">โครงการ</th>
              <th className="px-6 py-4 font-medium">วันที่ / กำหนดรับของ</th>
              <th className="px-6 py-4 font-medium text-right">ยอดรวม</th>
              <th className="px-6 py-4 font-medium text-center">สถานะ</th>
              <th className="px-6 py-4 font-medium text-center">ดูเอกสาร</th>
              <th className="px-6 py-4 font-medium text-center">จัดการ</th>
              <th className="px-6 py-4 font-medium text-center">รับสินค้า</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  <AppLoading />
                </td>
              </tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium">
                    ไม่พบข้อมูลใบสั่งซื้อตามเงื่อนไขที่ค้นหา
                  </p>
                </td>
              </tr>
            ) : (
              currentItems.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-slate-50/80 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800">
                      {po.po_number}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Ref: {po.reference_number || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-slate-800 font-medium">
                      {po.contact?.business_name || po.contact?.name || "-"}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tax ID: {po.contact?.tax_id || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 text-sm">
                    {po.project?.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-sm">
                    <div>{dayjs(po.created_at).format("DD/MM/YYYY")}</div>
                    <div className="text-xs mt-1 text-slate-400">
                      Due:{" "}
                      {po.expected_date
                        ? dayjs(po.expected_date).format("DD/MM/YYYY")
                        : "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-slate-700">
                    ฿
                    {Number(po.grand_total).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {getStatusBadge(po.status)}
                  </td>

                  <td width={150} className="px-6 py-4">
                    <button
                      onClick={() => {
                        router.push(`/purchase-orders/${po.id}`);
                      }}
                      className={`px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center justify-center gap-1.5 cursor-pointer w-full border ${
                        po.status === "Pending" && canApprove
                          ? "bg-amber-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                          : "bg-blue-500 text-white border-blue-200 hover:bg-blue-600"
                      }`}
                    >
                      {po.status === "Pending" && canApprove ? (
                        <>
                          <FileSignature className="w-3.5 h-3.5" />{" "}
                          ดูเอกสารเพื่ออนุมัติ
                        </>
                      ) : (
                        <>
                          <FileText className="w-3.5 h-3.5" /> ดูข้อมูล
                        </>
                      )}
                    </button>
                  </td>

                  <td width={50} className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative group/dropdown">
                        <button className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all flex items-center cursor-pointer">
                          <Ellipsis className="w-5 h-5" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl opacity-0 invisible group-hover/dropdown:opacity-100 group-hover/dropdown:visible transition-all duration-200 z-50 transform origin-top-right">
                          <ul className="p-1.5 text-sm text-slate-700 font-medium">
                            <li>
                              <button
                                onClick={() =>
                                  handleGeneratePDF(po.id, "preview")
                                }
                                className="flex items-center w-full px-3 py-2 hover:bg-slate-50 hover:text-indigo-600 rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Printer className="w-4 h-4 mr-2" /> พิมพ์เอกสาร
                                (Print)
                              </button>
                            </li>

                            {po.status === "Pending" && (
                              <li>
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/purchase-orders/${po.id}/edit`,
                                    )
                                  }
                                  className="flex items-center w-full px-3 py-2 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-colors text-left cursor-pointer"
                                >
                                  <Edit2 className="w-4 h-4 mr-2" /> แก้ไขเอกสาร
                                </button>
                              </li>
                            )}
                            <li>
                              <button
                                onClick={() =>
                                  handleGeneratePDF(po.id, "download")
                                }
                                className="flex items-center w-full px-3 py-2 hover:bg-slate-50 hover:text-green-600 rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Download className="w-4 h-4 mr-2" /> ดาวน์โหลด
                                PDF
                              </button>
                            </li>

                            {po.status === "Pending" && (
                              <>
                                <li className="my-1 border-t border-slate-100"></li>
                                <li>
                                  <button
                                    onClick={() => {
                                      setPoToDelete(po);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className="flex items-center w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> ลบเอกสาร
                                  </button>
                                </li>
                              </>
                            )}

                            {po.status === "Approved" && (
                              <>
                                <li className="my-1 border-t border-slate-100"></li>
                                <li>
                                  <button
                                    onClick={() => {
                                      setPoToCancel(po);
                                      setIsCancelDialogOpen(true);
                                    }}
                                    className="flex items-center w-full px-3 py-2 text-orange-600 hover:bg-orange-50 rounded-xl transition-colors text-left cursor-pointer"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />{" "}
                                    ยกเลิกเอกสาร (Void)
                                  </button>
                                </li>
                              </>
                            )}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td width={100} className="px-6 py-4 text-center">
                    {po.status === "Approved" || po.status === "Partial" ? (
                      canReceiveGoods ? (
                        <div className="relative flex justify-center">
                          <button
                            onClick={() => {
                              router.push(
                                `/goods-receipts/create?po_id=${po.id}`,
                              );
                            }}
                            className="px-3 py-1.5 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 border text-white bg-green-500 hover:bg-green-600 shadow-md shadow-green-500/20 cursor-pointer border-transparent"
                            title="กดเพื่อทำรายการรับสินค้าเข้าคลัง"
                          >
                            <PackagePlus className="w-3.5 h-3.5" /> รับของ
                          </button>
                        </div>
                      ) : (
                        <div
                          className="text-slate-300 text-xs font-medium cursor-not-allowed"
                          title="คุณไม่มีสิทธิ์รับสินค้า"
                        >
                          - ไม่อนุญาต -
                        </div>
                      )
                    ) : po.status === "Completed" ? (
                      <div className="relative flex justify-center">
                        <button
                          disabled
                          className="px-3 py-1.5 text-xs font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-full cursor-not-allowed opacity-60 flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />{" "}
                          รับครบแล้ว
                        </button>
                      </div>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={totalPages || 1}
        total={filteredPOs.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* 🛑 Modal ยืนยันการลบ (Trash) */}
      {isDeleteDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-red-100/50">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              ยืนยันการลบเอกสาร?
            </h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              คุณต้องการลบใบสั่งซื้อเลขที่ <br />
              <span className="font-bold text-slate-800 text-base">
                {poToDelete?.po_number}
              </span>{" "}
              ใช่หรือไม่?
              <br />
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsDeleteDialogOpen(false)}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmDelete}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                ลบเอกสาร
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛑 Modal ยืนยันการยกเลิกเอกสาร (Void) สไตล์สีส้ม */}
      {isCancelDialogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-orange-100/50">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              ยืนยันการยกเลิกเอกสาร?
            </h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              คุณต้องการยกเลิก (Void) ใบสั่งซื้อเลขที่ <br />
              <span className="font-bold text-slate-800 text-base">
                {poToCancel?.po_number}
              </span>{" "}
              ใช่หรือไม่?
              <br />
              (เมื่อยกเลิกแล้วจะไม่สามารถนำกลับมาใช้ได้อีก)
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setIsCancelDialogOpen(false)}
                className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={confirmCancel}
                className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-orange-600 hover:bg-orange-700 shadow-sm shadow-orange-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                ยืนยันยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" /> ตัวอย่างเอกสาร
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-slate-400 hover:text-red-500 bg-white rounded-full shadow-sm border border-slate-200 transition-all"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-slate-100 p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-slate-200"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
