"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PackageCheck,
  Plus,
  Search,
  FileText,
  Loader2,
  Eye,
  Ellipsis,
  Printer,
  Download,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Filter,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import { toast } from "sonner";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppPagination } from "@/components/ui/app-pagination";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function GoodsReceiptListPage() {
  const router = useRouter();
  const [grList, setGrList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 🚀 ตัวกรอง: ประเภทการรับ (จาก PO / ไม่มี PO), สถานะ, และช่วงวันที่รับสินค้า
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // 🚀 2. เรียกใช้สิทธิ์ผ่าน Hook บรรทัดเดียวจบ! (ลบ useState และ useEffect แบบเก่าทิ้งไปแล้ว)
  const canCreateGR = usePermission("create_goods_receipt");
  const canCreateGRNoPO = usePermission("create_goods_receipt_no_po");

  // ลอจิกการแบ่งหน้า (Pagination) ถอดแบบมาจากหน้าใบสั่งซื้อ
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // States สำหรับควบคุม Dropdown และ Modal ยกเลิก
  const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    grId: number | null;
    grNumber: string;
  }>({
    isOpen: false,
    grId: null,
    grNumber: "",
  });
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    fetchGoodsReceipts();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, filterDateFrom, filterDateTo]);

  const fetchGoodsReceipts = async () => {
    try {
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/goods-receipts`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
        },
      );

      if (res.ok) {
        const data = await res.json();
        setGrList(data);
      } else {
        const err = await res.json();
        toast.error("ดึงข้อมูลไม่ได้: " + (err.message || "ไม่ทราบสาเหตุ"));
      }
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateGR_PDF = async (
    gr: any,
    action: "print" | "download" | "preview",
  ) => {
    const toastId = toast.loading("กำลังเตรียมเอกสาร...");

    try {
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };

      const [itemsRes, compRes] = await Promise.all([
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/goods-receipts/${gr.id}/items`,
          { headers },
        ),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/company`, { headers }),
      ]);

      const items = await itemsRes.json();
      const compData = await compRes.json();

      const companySettings = Array.isArray(compData)
        ? compData[0]
        : compData.data || compData;

      const { pdf } = await import("@react-pdf/renderer");
      const { default: GRPdfTemplate } =
        await import("@/components/documents/GRPdfTemplate");

      const pdfDataObj = {
        companySettings,
        grData: gr,
        items: items,
        creator: gr.creator || null,
        ...getPaperSizeConfig(companySettings, "goods_receipt"),
      };

      const blob = await pdf(<GRPdfTemplate data={pdfDataObj} />).toBlob();
      const url = URL.createObjectURL(blob);
      toast.dismiss(toastId);

      // 🎯 แยกการทำงานตามที่กด
      // 🚀 "พิมพ์เอกสาร" เดิมเปิดแท็บใหม่แยกไปเลย ตอนนี้ให้แสดงผลแบบเดียวกับ "ดูข้อมูลใบรับของ"
      // (เปิด modal ตัวอย่างในหน้าเดิม กดพิมพ์จากปุ่มพิมพ์ในตัว viewer ของเบราว์เซอร์ได้เลย)
      if (action === "download") {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${gr.gr_number}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setPreviewUrl(url); // 🚀 โยน URL เข้า State เพื่อเปิด Modal (ใช้ร่วมกันทั้ง "print" และ "preview")
      }
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("สร้างเอกสาร PDF ไม่สำเร็จ");
    }
  };

  const openCancelModal = (grId: number, grNumber: string) => {
    setActiveDropdown(null);
    setCancelModal({ isOpen: true, grId, grNumber });
    setCancelReason("");
  };

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim())
      return toast.error("กรุณาระบุเหตุผลที่ต้องการยกเลิกเอกสาร");

    const toastId = toast.loading(
      "กำลังดำเนินการยกเลิกเอกสารและปรับปรุงสต๊อก...",
    );
    try {
      const token =
        localStorage.getItem("system_token") ||
        sessionStorage.getItem("system_token");

      // ยิง API ไปสั่งยกเลิกหลังบ้าน
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/goods-receipts/${cancelModal.grId}/cancel`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
          },
          body: JSON.stringify({ reason: cancelReason }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "ไม่สามารถยกเลิกเอกสารได้");
      }

      toast.success(
        `ยกเลิกเอกสาร ${cancelModal.grNumber} เรียบร้อยแล้ว (ระบบสต๊อกได้รับการปรับปรุง)`,
        { id: toastId },
      );
      setCancelModal({ isOpen: false, grId: null, grNumber: "" });
      fetchGoodsReceipts(); // โหลดข้อมูลตารางใหม่
    } catch (error: any) {
      toast.error("เกิดข้อผิดพลาด: " + error.message, { id: toastId });
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setCurrentPage(1);
  };

  // กรองข้อมูลตามคำค้นหา + ประเภทการรับ + สถานะ + ช่วงวันที่รับสินค้า
  const filteredGR = grList.filter((gr) => {
    const search = searchTerm.toLowerCase();
    const matchSearch =
      (gr.gr_number || "").toLowerCase().includes(search) ||
      (gr.po_number || "").toLowerCase().includes(search) ||
      (gr.business_name || gr.contact_name || "")
        .toLowerCase()
        .includes(search);

    const matchType =
      filterType === "all" ||
      (filterType === "po" && !!gr.po_number) ||
      (filterType === "direct" && !gr.po_number);

    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "Cancelled"
        ? gr.status === "Cancelled"
        : gr.status !== "Cancelled");

    const receivedDate = gr.received_date
      ? dayjs(gr.received_date).format("YYYY-MM-DD")
      : "";
    const matchDateFrom = !filterDateFrom || receivedDate >= filterDateFrom;
    const matchDateTo = !filterDateTo || receivedDate <= filterDateTo;

    return (
      matchSearch && matchType && matchStatus && matchDateFrom && matchDateTo
    );
  });

  // คำนวณแถวสำหรับทำ Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredGR.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredGR.length / itemsPerPage);

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-50 text-green-600 rounded-xl border border-green-100 dark:border-green-800/50 shadow-sm">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              ใบรับสินค้า (Goods Receipts)
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ประวัติการตรวจรับสินค้าเข้าคลังและจัดการเอกสารอ้างอิงใบสั่งซื้อ
            </p>
          </div>
        </div>

        {/* 🚀 3. เรนเดอร์ปุ่มตามเงื่อนไข (โค้ดส่วนนี้เหมือนเดิม แต่พึ่งพาตัวแปรจาก Hook ด้านบนแล้ว) */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* ปุ่มสร้างใบรับสินค้าจาก PO */}
          {canCreateGR && (
            <Link href="/goods-receipts/create" className="w-full sm:w-auto">
              <Button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> <span>สร้างใบรับสินค้าจาก PO</span>
              </Button>
            </Link>
          )}

          {/* ปุ่มสร้างใบรับสินค้าไม่มี PO (Direct GR) */}
          {canCreateGRNoPO && (
            <Link
              href="/goods-receipts/create-direct"
              className="w-full sm:w-auto"
            >
              <Button className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> สร้างใบรับสินค้าไม่มี PO
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* แถบเครื่องมือค้นหา + ตัวกรอง สไตล์หน้า PO */}
      <div className="bg-card rounded-t-xl border border-border border-b-0 w-full">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 p-4 bg-muted/50 items-center w-full rounded-t-xl">
          {/* ช่องค้นหา - กว้าง 2 ช่อง */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="ค้นหาเลขที่ GR, PO หรือชื่อผู้จำหน่าย..."
              className="w-full h-10 pl-10 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm bg-background"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <AppSelect
              value={filterType}
              onValueChange={setFilterType}
              triggerClassName="pl-10"
              options={[
                { value: "all", label: "ประเภทการรับทั้งหมด" },
                { value: "po", label: "รับสินค้าจาก PO" },
                { value: "direct", label: "รับสินค้าไม่มี PO" },
              ]}
            />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <AppSelect
              value={filterStatus}
              onValueChange={setFilterStatus}
              triggerClassName="pl-10"
              options={[
                { value: "all", label: "สถานะทั้งหมด" },
                { value: "Completed", label: "สำเร็จ" },
                { value: "Cancelled", label: "ยกเลิกเอกสาร" },
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
            className="w-full h-10 px-4 flex items-center justify-center gap-2 text-foreground bg-background border border-border hover:bg-muted rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      {/* ตารางแสดงรายการข้อมูล */}
      <div className="border border-border rounded-b-xl bg-card hide-scrollbar overflow-x-auto pb-10 min-h-[300px]">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-medium">เลขที่เอกสาร (GR)</th>
              <th className="px-6 py-4 font-medium">อ้างอิงใบสั่งซื้อ (PO)</th>
              <th className="px-6 py-4 font-medium">ผู้จำหน่าย (Supplier)</th>
              <th className="px-6 py-4 font-medium">วันที่รับสินค้า</th>
              <th className="px-6 py-4 font-medium text-center">สถานะ</th>
              <th className="px-6 py-4 font-medium text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-muted-foreground"
                >
                  <AppLoading />
                </td>
              </tr>
            ) : currentItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">
                    ยังไม่มีประวัติการรับสินค้าในระบบ
                  </p>
                </td>
              </tr>
            ) : (
              currentItems.map((gr) => (
                <tr
                  key={gr.id}
                  className="hover:bg-muted/50 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-foreground">
                      {gr.gr_number}
                    </div>
                    {gr.reference_number && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Ref: {gr.reference_number}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 font-bold">
                    {gr.po_number ? (
                      <span className="text-blue-600">{gr.po_number}</span>
                    ) : (
                      <span className="text-red-500 bg-red-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200">
                        รับโดยไม่มี PO
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-foreground font-medium">
                    {gr.business_name || gr.contact_name || "-"}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {dayjs(gr.received_date).format("DD/MM/YYYY")}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        gr.status === "Cancelled"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {gr.status === "Cancelled" ? "ยกเลิกเอกสาร" : "สำเร็จ"}
                    </span>
                  </td>

                  {/* ปุ่ม Action Dropdown สามจุดสไตล์หน้า PO */}
                  <td width={100} className="px-6 py-4 text-center relative">
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === gr.id ? null : gr.id,
                          )
                        }
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all flex items-center cursor-pointer"
                      >
                        <Ellipsis className="w-5 h-5" />
                      </button>

                      {activeDropdown === gr.id && (
                        <div className="absolute right-16 top-10 translate-y-0 w-48 bg-card border border-border rounded-2xl shadow-xl opacity-100 visible transition-all duration-200 z-50 transform origin-top-right">
                          <ul className="p-1.5 text-sm text-foreground font-medium text-left">
                            <li>
                              <button
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleGenerateGR_PDF(gr, "preview"); // 🚀 สั่งพรีวิว
                                }}
                                className="flex items-center w-full px-3 py-2 hover:bg-muted/50 hover:text-blue-600 rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Eye className="w-4 h-4 mr-2 text-blue-500" />{" "}
                                ดูข้อมูลใบรับของ
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleGenerateGR_PDF(gr, "print"); // 🚀 สั่งพิมพ์
                                }}
                                className="flex items-center w-full px-3 py-2 hover:bg-muted/50 hover:text-slate-900 rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Printer className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                                พิมพ์เอกสาร
                              </button>
                            </li>
                            <li>
                              <button
                                onClick={() => {
                                  setActiveDropdown(null);
                                  handleGenerateGR_PDF(gr, "download"); // 🚀 สั่งดาวน์โหลด
                                }}
                                className="flex items-center w-full px-3 py-2 hover:bg-muted/50 hover:text-green-600 rounded-xl transition-colors text-left cursor-pointer"
                              >
                                <Download className="w-4 h-4 mr-2 text-muted-foreground" />{" "}
                                ดาวน์โหลด PDF
                              </button>
                            </li>
                            {gr.status !== "Cancelled" && (
                              <>
                                <li className="my-1 border-t border-border"></li>
                                <li>
                                  <button
                                    onClick={() =>
                                      openCancelModal(gr.id, gr.gr_number)
                                    }
                                    className="flex items-center w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-left cursor-pointer font-bold"
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />{" "}
                                    ยกเลิกใบรับสินค้า
                                  </button>
                                </li>
                              </>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
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
        total={filteredGR.length}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* 🛑 Modal ยืนยันการยกเลิกเอกสารพร้อมกล่องคำอธิบายสิทธิ์สากล (ไม่ใช้ Alert ขัดหูขัดตา) */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl transform animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 border-[6px] border-red-100/50">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2 text-center">
              ยืนยันการยกเลิกใบรับสินค้า?
            </h3>

            {/* 📝 กล่องข้อความอธิบายวิธีทำงานตามมาตรฐาน ERP ใน Modal */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 mb-4 text-xs text-amber-800 leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 mb-1 text-sm text-amber-900">
                ⚠️ ลำดับขั้นตอนการทำงานของระบบ:
              </div>
              1. สต๊อกสินค้าที่เพิ่มเข้าคลังจากบิลนี้จะถูก{" "}
              <span className="font-bold text-red-700">หักลบออกทันที</span>
              <br />
              2. หมายเลข{" "}
              <span className="font-bold text-red-700">
                Serial Number (S/N)
              </span>{" "}
              ทั้งหมดในบิลนี้จะถูกลบและทำลายสิทธิ์
              <br />
              3. จำนวนค้างรับของใบสั่งซื้อ (PO) ต้นทาง
              จะถูกตีกลับมาเปิดให้รับของใหม่ได้อีกครั้ง
            </div>

            <p className="text-muted-foreground text-sm mb-4 text-center">
              คุณต้องการยกเลิกใบรับสินค้าเลขที่ <br />
              <span className="font-bold text-slate-900 text-base">
                {cancelModal.grNumber}
              </span>{" "}
              ใช่หรือไม่?
            </p>

            {/* กล่องกรอกข้อมูลเหตุผลการยกเลิก */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">
                เหตุผลในการยกเลิก (Human Error) *
              </label>
              <input
                type="text"
                placeholder="เช่น คีย์ตัวเลขผิดพลาด, ยิงบาร์โค้ด S/N ซ้ำซ้อน"
                className="w-full h-11 px-4 border border-border rounded-xl outline-none focus:border-red-500 text-sm bg-muted/50 focus:bg-background transition-all"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() =>
                  setCancelModal({ isOpen: false, grId: null, grNumber: "" })
                }
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                ย้อนกลับ
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-700 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              >
                ยืนยันการยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚀 Modal พรีวิว PDF (สไตล์เดียวกับหน้า PO) */}
      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />{" "}
                ตัวอย่างเอกสารใบรับสินค้า
              </h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-muted-foreground hover:text-red-500 bg-background rounded-full shadow-sm border border-border transition-all cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 bg-muted p-2">
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-border"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}