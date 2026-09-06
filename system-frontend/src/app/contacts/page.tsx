"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Building2,
  User,
  Loader2,
  Search,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  AlertTriangle,
  UserSquare,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// 🚀 นำเข้า Component ที่เราเพิ่งสร้าง (แก้ Path ให้ตรงกับโฟลเดอร์ของพี่แม็คนะครับ)
import ContactExcelActions from "@/components/contacts/ContactExcelActions";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { usePermission } from "@/hooks/usePermission";

const BANK_NAMES: Record<string, string> = {
  bbl: "ธนาคารกรุงเทพ",
  kbank: "ธนาคารกสิกรไทย",
  ktb: "ธนาคารกรุงไทย",
  ttb: "ธนาคารทหารไทยธนชาต",
  scb: "ธนาคารไทยพาณิชย์",
  bay: "ธนาคารกรุงศรีอยุธยา",
  kkp: "ธนาคารเกียรตินาคินภัทร",
  cimb: "ธนาคารซีไอเอ็มบีไทย",
  tisco: "ธนาคารทิสโก้",
  uob: "ธนาคารยูโอบี",
  tcd: "ธนาคารไทยเครดิต",
  lhb: "ธนาคารแลนด์ แอนด์ เฮ้าส์",
  baac: "ธนาคารเพื่อการเกษตรและสหกรณ์",
  gsb: "ธนาคารออมสิน",
  ghb: "ธนาคารอาคารสงเคราะห์",
  isbt: "ธนาคารอิสลามแห่งประเทศไทย",
};

const formatBankName = (code: string) => {
  if (!code) return "-";
  return BANK_NAMES[code.toLowerCase()] || code;
};

const formatAccountType = (type: string) => {
  if (type === "savings") return "ออมทรัพย์";
  if (type === "current") return "กระแสรายวัน";
  return type || "-";
};

export default function ContactsListPage() {
  const canCreate = usePermission("create_contacts");
  const canEdit = usePermission("edit_contacts");
  const canDelete = usePermission("delete_contacts");
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [viewContact, setViewContact] = useState<any>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<any>(null);

  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  useEffect(() => {
    fetchContacts();

    // 🚀 ระบบดักฟังสัญญาณ Refresh จาก ContactExcelActions
    const handleRefresh = () => fetchContacts();
    window.addEventListener("refreshContacts", handleRefresh);
    return () => window.removeEventListener("refreshContacts", handleRefresh);
  }, []);

  const fetchContacts = async () => {
    try {
      const data = await apiFetch("/contacts");
      setContacts(data);
    } catch (error) {
      // 🛡️ เดิม fetch ล้มเหลวเงียบๆ ไม่มี toast ผู้ใช้แยกไม่ออกว่า "ยังไม่มีข้อมูล" หรือ "โหลดพัง"
      console.error("Failed to fetch contacts", error);
      toast.error("โหลดรายชื่อผู้ติดต่อไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    // ประเภทผู้ติดต่อ
    if (filterType === "customer" && !contact.is_customer) return false;
    if (filterType === "vendor" && !contact.is_vendor) return false;

    // สถานะการใช้งาน
    if (filterStatus === "active" && contact.is_active === false) return false;
    if (filterStatus === "inactive" && contact.is_active !== false)
      return false;

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchCode = contact.contact_code
        ?.toLowerCase()
        .includes(searchLower);
      const matchBizName = contact.business_name
        ?.toLowerCase()
        .includes(searchLower);
      const matchPersonName = contact.contact_person_name
        ?.toLowerCase()
        .includes(searchLower);
      const matchPhone =
        contact.office_phone?.includes(searchTerm) ||
        contact.mobile?.includes(searchTerm);
      const matchTaxId = contact.tax_id?.includes(searchTerm);

      if (
        !matchCode &&
        !matchBizName &&
        !matchPersonName &&
        !matchPhone &&
        !matchTaxId
      ) {
        return false;
      }
    }
    return true;
  });

  const totalItems = filteredContacts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentData = filteredContacts.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus, itemsPerPage]);

  const toggleContactStatus = async (id: number, currentStatus: boolean) => {
    setIsTogglingStatus(true);
    try {
      await apiFetch(`/contacts/${id}/toggle-status`, { method: "PATCH" });
      toast.success(
        currentStatus ? "ระงับการใช้งานสำเร็จ" : "เปิดการใช้งานสำเร็จ",
      );

      setContacts((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: !currentStatus } : c,
        ),
      );
      setViewContact((prev: any) =>
        prev && prev.id === id ? { ...prev, is_active: !currentStatus } : prev,
      );
    } catch (error: any) {
      toast.error(error.message || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const confirmDelete = (contact: any) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!contactToDelete) return;
    try {
      await apiFetch(`/contacts/${contactToDelete.id}`, { method: "DELETE" });
      toast.success("ลบข้อมูลสำเร็จ!");

      setDeleteDialogOpen(false);
      setContactToDelete(null);
      setViewContact(null);

      fetchContacts();
    } catch (error: any) {
      toast.error(error.message || "ไม่สามารถลบได้ อาจมีธุรกรรมผูกพันอยู่");
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] p-8 text-center rounded-2xl bg-white border-0 shadow-2xl">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-2 border-[6px] border-red-50/50">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <DialogTitle className="text-2xl font-bold text-slate-800 tracking-tight">
              ลบรายชื่อผู้ติดต่อ?
            </DialogTitle>
            <p className="text-slate-500 text-sm leading-relaxed px-4">
              คุณต้องการลบรายชื่อ <br />
              <span className="font-bold text-slate-800 text-base">
                "{contactToDelete?.business_name}"
              </span>
              <br />
              ใช่หรือไม่?
              <br />
              <br />
              <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">
                *ระบบจะลบได้เฉพาะรายชื่อที่ยังไม่มีการทำธุรกรรมเท่านั้น
              </span>
            </p>
            <div className="flex justify-center gap-3 w-full mt-6 pt-2">
              <Button
                variant="outline"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-200 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
                onClick={() => setDeleteDialogOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-red-600 hover:bg-red-800 shadow-sm shadow-red-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
                onClick={executeDelete}
              >
                ยืนยันการลบ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewContact}
        onOpenChange={(open) => !open && setViewContact(null)}
      >
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-slate-50/80 backdrop-blur-sm border-slate-200/60 shadow-2xl">
          <div className="bg-white px-8 py-6 border-b border-slate-200">
            <div className="flex flex-col">
              <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  {viewContact?.contact_type === "company" ? (
                    <Building2 className="w-6 h-6" />
                  ) : (
                    <User className="w-6 h-6" />
                  )}
                </div>
                {viewContact?.business_name}
              </DialogTitle>

              <div className="flex items-center justify-between mt-3 ml-12">
                <div className="flex items-center gap-3">
                  <Badge
                    variant="outline"
                    className="bg-slate-50 text-slate-600 border-slate-200 px-3 py-1 text-sm font-mono"
                  >
                    รหัส: {viewContact?.contact_code}
                  </Badge>
                  {(viewContact?.is_customer === true ||
                    viewContact?.is_customer === 1 ||
                    viewContact?.is_customer === "1") && (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 py-1 text-sm">
                      ลูกค้า
                    </Badge>
                  )}

                  {(viewContact?.is_vendor === true ||
                    viewContact?.is_vendor === 1 ||
                    viewContact?.is_vendor === "1") && (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none px-3 py-1 text-sm">
                      ผู้จำหน่าย
                    </Badge>
                  )}
                  {viewContact?.is_active === false && (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none px-3 py-1 text-sm">
                      🔴 ถูกระงับ
                    </Badge>
                  )}
                </div>

                {viewContact && (
                  <div className="flex items-center gap-2">
                    {canEdit && (
                      <Button
                        variant="outline"
                        disabled={isTogglingStatus}
                        onClick={() =>
                          toggleContactStatus(
                            viewContact.id,
                            viewContact.is_active !== false,
                          )
                        }
                        className={`h-9 px-3 rounded-full shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${
                          viewContact.is_active !== false
                            ? "border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
                            : "border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                        }`}
                      >
                        {isTogglingStatus ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : viewContact.is_active !== false ? (
                          <Ban className="w-4 h-4 mr-2" />
                        ) : (
                          <CheckCircle className="w-4 h-4 mr-2" />
                        )}
                        {viewContact.is_active !== false
                          ? "ระงับใช้งาน"
                          : "เปิดใช้งาน"}
                      </Button>
                    )}

                    {canDelete && (
                      <Button
                        variant="outline"
                        onClick={() => confirmDelete(viewContact)}
                        className="h-9 px-3 rounded-full border-red-200 text-red-600 bg-red-50 hover:bg-red-100 shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> ลบ
                      </Button>
                    )}

                    {canEdit && (
                      <Link href={`/contacts/${viewContact.id}/edit`}>
                        <Button
                          variant="outline"
                          className="h-9 px-3 rounded-full border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 shadow-sm cursor-pointer transition-all hover:scale-102 transition-transform"
                        >
                          <Edit className="w-4 h-4 mr-2" /> แก้ไขข้อมูล
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {viewContact && (
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              {viewContact.is_active === false && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-20 flex items-center justify-center pointer-events-none rounded-b-lg">
                  <div className="text-4xl font-bold text-red-500/20 -rotate-12 border-4 border-red-500/20 p-8 rounded-3xl">
                    ระงับการใช้งาน
                  </div>
                </div>
              )}

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Building2 className="w-5 h-5 text-blue-500" /> ข้อมูลองค์กร
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      ประเภทธุรกิจ
                    </label>
                    <p className="mt-1 text-slate-700 font-medium">
                      {viewContact.contact_type === "company"
                        ? "นิติบุคคล"
                        : "บุคคลธรรมดา"}
                    </p>
                  </div>
                  <div>
                    <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      สาขา
                    </label>
                    <p className="mt-1 text-slate-700 font-medium">
                      {viewContact.branch_type === "branch"
                        ? `สาขา ${viewContact.branch_code}`
                        : "สำนักงานใหญ่"}
                    </p>
                  </div>
                  <div>
                    <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      เลขผู้เสียภาษี
                    </label>
                    <p className="mt-1 text-slate-700 font-medium font-mono text-base">
                      {viewContact.tax_id || "-"}
                    </p>
                  </div>
                  <div>
                    <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      เครดิต (วัน)
                    </label>
                    <p className="mt-1 text-slate-700 font-medium text-base">
                      {viewContact.credit_days} วัน
                    </p>
                  </div>

                  <div className="col-span-2 pt-3 mt-1 border-t border-slate-100">
                    <div className="grid grid-cols-1 gap-y-4 gap-x-4">
                      <div>
                        <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          ธนาคาร / สาขา
                        </label>
                        {viewContact.bank_name ? (
                          <div className="flex items-center gap-2 mt-1">
                            <img
                              src={`/banks/${viewContact.bank_name.toLowerCase()}.svg`}
                              alt={viewContact.bank_name}
                              className="w-5 h-5 rounded-full object-cover border border-slate-200 shadow-sm bg-white"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                            <p className="text-slate-700 font-medium truncate">
                              {formatBankName(viewContact.bank_name)}{" "}
                              {viewContact.branch_name
                                ? `(${viewContact.branch_name})`
                                : ""}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-1 text-slate-700 font-medium">-</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-4 mt-4">
                      <div>
                        <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          เลขบัญชีธนาคาร
                        </label>
                        <p className="mt-1 text-slate-700 font-medium font-mono text-base">
                          {viewContact.account_number || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          ชื่อบัญชี
                        </label>
                        <p
                          className="mt-1 text-slate-700 font-medium truncate"
                          title={viewContact.account_name}
                        >
                          {viewContact.account_name || "-"}
                        </p>
                      </div>
                      <div>
                        <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                          ประเภทบัญชี
                        </label>
                        <p className="mt-1 text-slate-700 font-medium">
                          {formatAccountType(viewContact.account_type)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <User className="w-5 h-5 text-blue-500" /> ข้อมูลการติดต่อ
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        ชื่อผู้ติดต่อ
                      </label>
                      <p className="mt-1 text-slate-700 font-medium text-base truncate">
                        {viewContact.contact_person_name || "-"}
                      </p>
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        เบอร์โทรศัพท์
                      </label>
                      <p className="mt-1 text-slate-700 font-medium">
                        {viewContact.office_phone || viewContact.mobile || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        อีเมล
                      </label>
                      <p
                        className="mt-1 text-slate-700 font-medium truncate"
                        title={viewContact.email}
                      >
                        {viewContact.email || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        เว็บไซต์
                      </label>
                      <p
                        className="mt-1 text-slate-700 font-medium text-blue-600 truncate"
                        title={viewContact.website}
                      >
                        {viewContact.website ? (
                          <a
                            href={
                              viewContact.website.startsWith("http")
                                ? viewContact.website
                                : `https://${viewContact.website}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {viewContact.website}
                          </a>
                        ) : (
                          "-"
                        )}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      ที่อยู่
                    </label>
                    <div className="mt-1 text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[80px] leading-relaxed">
                      {viewContact.address || "ไม่ได้ระบุที่อยู่"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <UserSquare className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สมุดรายชื่อผู้ติดต่อ
            </h1>
            <p className="text-slate-500 text-[11px]">
              จัดการข้อมูลลูกค้าและผู้จำหน่ายทั้งหมด
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ContactExcelActions
            searchTerm={searchTerm}
            filterType={filterType}
          />

          {canCreate && (
            <Link href="/contacts/create">
              <Button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-800 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> เพิ่มผู้ติดต่อใหม่
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row justify-between items-center gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center gap-3 w-full xl:w-auto">
            {/* ค้นหา */}
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="ค้นหา รหัส, ชื่อ, เลขผู้เสียภาษี, เบอร์โทร..."
                className="pl-9 h-12 rounded-xl bg-white dark:bg-slate-950 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* ประเภทผู้ติดต่อ */}
            <div className="w-full sm:w-60">
              <AppSelect
                value={filterType}
                onValueChange={setFilterType}
                placeholder="เลือกประเภทผู้ติดต่อ"
                triggerClassName="h-12"
                options={[
                  { value: "all", label: "ประเภททั้งหมด" },
                  { value: "customer", label: "เฉพาะลูกค้า" },
                  { value: "vendor", label: "เฉพาะผู้จำหน่าย" },
                ]}
              />
            </div>

            {/* สถานะ is_active */}
            <div className="w-full sm:w-60">
              <AppSelect
                value={filterStatus}
                onValueChange={setFilterStatus}
                placeholder="เลือกสถานะ"
                triggerClassName="h-12"
                options={[
                  { value: "all", label: "สถานะทั้งหมด" },
                  { value: "active", label: "เปิดใช้งาน" },
                  { value: "inactive", label: "ถูกระงับ" },
                ]}
              />
            </div>
          </div>

          {/* จำนวนรายการต่อหน้า */}
          <div className="flex items-center gap-2 text-sm text-slate-500 w-full xl:w-auto justify-end">
            <span className="whitespace-nowrap">แสดงหน้าละ:</span>
            <div className="w-28">
              <AppSelect
                value={String(itemsPerPage)}
                onValueChange={(value) => setItemsPerPage(Number(value))}
                triggerClassName="h-12"
                options={[
                  { value: "10", label: "10" },
                  { value: "20", label: "20" },
                  { value: "50", label: "50" },
                  { value: "100", label: "100" },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar flex-1">
          {loading ? (
            <AppLoading minHeight="min-h-0" className="p-12" />
          ) : currentData.length === 0 ? (
            <div className="text-center p-12 text-slate-500">
              {searchTerm || filterType !== "all" || filterStatus !== "all"
                ? "ไม่พบข้อมูลที่ค้นหา"
                : "ยังไม่มีข้อมูลผู้ติดต่อในระบบ"}
            </div>
          ) : (
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">รหัสผู้ติดต่อ</th>
                  <th className="px-6 py-4">ชื่อธุรกิจ</th>
                  <th className="px-6 py-4 text-slate-500">สำนักงาน/สาขา</th>
                  <th className="px-6 py-4 text-slate-500">เลขผู้เสียภาษี</th>
                  <th className="px-6 py-4 text-slate-500">ชื่อผู้ติดต่อ</th>
                  <th className="px-6 py-4 text-slate-500">อีเมล</th>
                  <th className="px-6 py-4 text-slate-500">เบอร์โทร</th>
                  <th className="px-6 py-4">ประเภท</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {currentData.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => setViewContact(contact)}
                    className={`hover:bg-blue-100 dark:hover:bg-slate-700 transition-all cursor-pointer group ${contact.is_active === false ? "opacity-60 bg-slate-50" : ""}`}
                  >
                    <td className="px-6 py-3 font-medium text-blue-600">
                      {contact.contact_code}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {contact.contact_type === "company" ? (
                          <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <span
                          className="truncate max-w-[200px]"
                          title={contact.business_name}
                        >
                          {contact.business_name}
                        </span>
                        {contact.is_active === false && (
                          <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">
                            ระงับ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {contact.branch_type === "branch" ? (
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs">
                          สาขา {contact.branch_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          สำนักงานใหญ่
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-500 font-mono text-xs">
                      {contact.tax_id || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-600">
                      {contact.contact_person_name || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {contact.email || "-"}
                    </td>
                    <td className="px-6 py-3 text-slate-500">
                      {contact.office_phone || contact.mobile || "-"}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1.5">
                        {contact.is_customer ? (
                          <Badge
                            variant="outline"
                            className="p-2 bg-green-50 text-green-600 border-green-200 font-bold"
                          >
                            ลูกค้า
                          </Badge>
                        ) : null}
                        {contact.is_vendor ? (
                          <Badge
                            variant="outline"
                            className="p-2 bg-purple-50 text-purple-600 border-purple-200 font-bold"
                          >
                            ผู้จำหน่าย
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AppPagination
        currentPage={currentPage}
        lastPage={totalPages || 1}
        total={totalItems}
        perPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
