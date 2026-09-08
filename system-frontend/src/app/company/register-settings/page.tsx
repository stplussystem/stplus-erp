"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HousePlus,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  Users,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { AppTooltip } from "@/components/ui/app-tooltip";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import RegisterCompanyForm from "@/components/company/RegisterCompanyForm";
import { cn } from "@/lib/utils";

type CompanyRow = {
  id: number;
  name: string;
  tax_id: string | null;
  phone: string | null;
  is_approved: boolean;
  users_count: number;
  created_at: string;
};

// 🛡️ เมนูนี้เห็นเฉพาะ Platform Admin เท่านั้น (ดู UserSessionFormatter.php ฝั่ง backend ที่เติมเมนูนี้เข้าไป
// เฉพาะ user.is_platform_admin) — ไม่ใช้ RoleRouteGuard เพราะตัวนั้น bypass ให้ isSuperAdmin ของทุกบริษัท
// ด้วย ซึ่งไม่ต้องการตรงนี้ (ต้องเป็น Platform Admin เจ้าของระบบเท่านั้นจริงๆ)
export default function RegisterCompanyVisibilitySettingsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [savingApproval, setSavingApproval] = useState(false);
  const [showRegisterLink, setShowRegisterLink] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [companyToApprove, setCompanyToApprove] = useState<CompanyRow | null>(null);
  const [companyToReject, setCompanyToReject] = useState<CompanyRow | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    Accept: "application/json",
  });

  useEffect(() => {
    try {
      const rawUser = getUserRaw();
      // 🛡️ storage เก็บ payload ทั้งก้อน {user: {...}} เสมอ (ดูคอมเมนต์ใน login/page.tsx) ต้อง unwrap
      // .user ก่อนเสมอ
      const user = rawUser ? JSON.parse(rawUser)?.user : null;
      if (!user?.is_platform_admin) {
        toast.error("เฉพาะ Platform Admin เท่านั้นที่เข้าหน้านี้ได้");
        router.replace("/dashboard");
        return;
      }
      setIsAuthorized(true);
    } catch {
      router.replace("/dashboard");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSettings = async () => {
    try {
      const [visRes, apprRes] = await Promise.all([
        fetch(`${apiUrl}/settings/register-company-visibility`, { headers: authHeaders() }),
        fetch(`${apiUrl}/settings/company-approval-mode`, { headers: authHeaders() }),
      ]);
      if (visRes.ok) setShowRegisterLink(!!(await visRes.json()).show_register_company_link);
      if (apprRes.ok) setRequireApproval(!!(await apprRes.json()).require_company_approval);
      if (!visRes.ok || !apprRes.ok) toast.error("โหลดการตั้งค่าไม่สำเร็จ");
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoadingSettings(false);
    }
  };

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const res = await fetch(`${apiUrl}/companies`, { headers: authHeaders() });
      if (res.ok) setCompanies(await res.json());
      else toast.error("โหลดรายชื่อบริษัทไม่สำเร็จ");
    } catch {
      toast.error("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoadingCompanies(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return;
    fetchSettings();
    fetchCompanies();
  }, [isAuthorized]);

  // 🚀 reset กลับหน้า 1 ทุกครั้งที่ค่าค้นหา/filter เปลี่ยน (ตาม .claude/docs/frontend-page-template.md
  // ส่วน 5.1) ไม่งั้นค้นหาแล้วอาจค้างอยู่หน้าที่ไม่มีข้อมูล
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const toggleShowRegisterLink = async (checked: boolean) => {
    setSavingVisibility(true);
    try {
      const res = await fetch(`${apiUrl}/settings/register-company-visibility`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error();
      setShowRegisterLink(checked);
      toast.success(
        checked
          ? "แสดงลิงก์ลงทะเบียนบริษัทที่หน้า login แล้ว"
          : "ซ่อนลิงก์ลงทะเบียนบริษัทที่หน้า login แล้ว",
      );
    } catch {
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSavingVisibility(false);
    }
  };

  const toggleRequireApproval = async (checked: boolean) => {
    setSavingApproval(true);
    try {
      const res = await fetch(`${apiUrl}/settings/company-approval-mode`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: checked }),
      });
      if (!res.ok) throw new Error();
      setRequireApproval(checked);
      toast.success(
        checked
          ? "เปิดโหมดรออนุมัติแล้ว บริษัทที่สมัครใหม่ผ่านหน้าสาธารณะจะ login ไม่ได้จนกว่าจะอนุมัติ"
          : "ปิดโหมดรออนุมัติแล้ว บริษัทที่สมัครใหม่จะใช้งานได้ทันที",
      );
    } catch {
      toast.error("บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSavingApproval(false);
    }
  };

  const handleCreateSuccess = (result?: { pending?: boolean }) => {
    setIsCreateOpen(false);
    toast.success(
      result?.pending
        ? "สร้างบริษัทใหม่สำเร็จ! (รออนุมัติ)"
        : "สร้างบริษัทใหม่สำเร็จ! ลูกค้าเข้าสู่ระบบด้วยบัญชีที่กรอกไว้ได้ทันที",
    );
    fetchCompanies();
  };

  const proceedApprove = async () => {
    if (!companyToApprove) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiUrl}/companies/${companyToApprove.id}/approve`, {
        method: "PATCH",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setCompanyToApprove(null);
      fetchCompanies();
    } catch (e: any) {
      toast.error(e?.message || "อนุมัติไม่สำเร็จ");
    } finally {
      setIsProcessing(false);
    }
  };

  const proceedReject = async () => {
    if (!companyToReject) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${apiUrl}/companies/${companyToReject.id}/reject`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setCompanyToReject(null);
      fetchCompanies();
    } catch (e: any) {
      toast.error(e?.message || "ปฏิเสธไม่สำเร็จ");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCompanies = useMemo(() => {
    return companies.filter((c) => {
      const matchesSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.tax_id || "").includes(search) ||
        (c.phone || "").includes(search);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && !c.is_approved) ||
        (statusFilter === "approved" && c.is_approved);
      return matchesSearch && matchesStatus;
    });
  }, [companies, search, statusFilter]);

  const paginatedCompanies = filteredCompanies.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  if (!isAuthorized || loadingSettings) {
    return (
      <AppLoading
        text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..."
        minHeight="min-h-screen"
        className="bg-muted/50"
      />
    );
  }

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <HousePlus className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">ลงทะเบียนบริษัท</h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              จัดการรายชื่อบริษัทที่ลงทะเบียนในระบบ และควบคุมการสมัครใช้งานบริษัทใหม่
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <UserPlus className="w-4 h-4" /> ลงทะเบียนบริษัท
        </button>
      </div>

      {/* 🚀 2 คอลัมน์: ซ้าย = สวิตช์ลิงก์สมัครที่หน้า login (เดิม), ขวา = สวิตช์โหมดรออนุมัติ (ใหม่) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                แสดงลิงก์ "สร้างระบบสำหรับบริษัทคุณ" ที่หน้า Login
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                ปิดสวิตช์นี้เพื่อซ่อนลิงก์สมัครเปิดบริษัทใหม่จากหน้า login สาธารณะ (ยังเข้าหน้า
                /register-company ตรงๆ ผ่าน URL ได้อยู่ แค่ไม่มีลิงก์ให้กดจากหน้า login เท่านั้น)
              </p>
            </div>
            <Switch
              checked={showRegisterLink}
              disabled={savingVisibility}
              onCheckedChange={toggleShowRegisterLink}
            />
          </div>
        </div>

        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                รออนุมัติจาก Platform Admin ก่อนเข้าใช้งาน
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                เปิดสวิตช์นี้เพื่อให้บริษัทที่สมัครผ่านหน้า /register-company สาธารณะต้องรอ Platform
                Admin อนุมัติก่อนจึง login ได้ (บริษัทที่ Platform Admin สร้างเองผ่านปุ่ม "ลงทะเบียน
                บริษัท" ด้านบนไม่ติดเงื่อนไขนี้ ใช้งานได้ทันทีเสมอ)
              </p>
            </div>
            <Switch
              checked={requireApproval}
              disabled={savingApproval}
              onCheckedChange={toggleRequireApproval}
            />
          </div>
        </div>
      </div>

      {/* 🚀 รายชื่อบริษัทที่ลงทะเบียนในระบบ + ค้นหา/กรองสถานะ */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mt-6">
        <div className="p-4 border-b border-border flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อบริษัท, เลขผู้เสียภาษี, เบอร์โทร..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
            />
          </div>
          <div className="w-full md:w-56">
            <AppSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "all", label: "ทุกสถานะ" },
                { value: "pending", label: "รออนุมัติ" },
                { value: "approved", label: "ใช้งานได้" },
              ]}
            />
          </div>
        </div>

        {loadingCompanies ? (
          <AppLoading />
        ) : filteredCompanies.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground">
            ไม่พบบริษัทที่ตรงกับเงื่อนไขค้นหา
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border">
                  <TableHead className="px-6 py-4 font-bold">ชื่อบริษัท</TableHead>
                  <TableHead className="px-6 py-4 font-bold">เลขผู้เสียภาษี / โทร</TableHead>
                  <TableHead className="px-6 py-4 font-bold text-center">ผู้ใช้งาน</TableHead>
                  <TableHead className="px-6 py-4 font-bold text-center">สถานะ</TableHead>
                  <TableHead className="px-6 py-4 font-bold">สมัครเมื่อ</TableHead>
                  <TableHead className="px-6 py-4 font-bold text-center">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {paginatedCompanies.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-2 font-bold text-foreground">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        {c.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-muted-foreground text-sm">
                      {c.tax_id || c.phone ? (
                        <>
                          {c.tax_id && <div>{c.tax_id}</div>}
                          {c.phone && <div>{c.phone}</div>}
                        </>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="w-3.5 h-3.5" /> {c.users_count}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-center">
                      {c.is_approved ? (
                        <Badge className="bg-green-50 text-green-600 border-green-200 text-xs font-bold">
                          ใช้งานได้
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-xs font-bold">
                          รออนุมัติ
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="px-6 py-4">
                      {!c.is_approved ? (
                        <div className="flex items-center justify-center gap-1">
                          <AppTooltip label="อนุมัติ">
                            <button
                              type="button"
                              onClick={() => setCompanyToApprove(c)}
                              className="p-2 text-muted-foreground hover:text-green-600 hover:bg-green-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          </AppTooltip>
                          <AppTooltip label="ปฏิเสธ">
                            <button
                              type="button"
                              onClick={() => setCompanyToReject(c)}
                              className="p-2 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </AppTooltip>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <span className="text-xs text-muted-foreground">-</span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="px-4 pb-4">
          <AppPagination
            currentPage={currentPage}
            lastPage={Math.max(1, Math.ceil(filteredCompanies.length / itemsPerPage))}
            total={filteredCompanies.length}
            perPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      </div>

      {/* 🚀 Modal ลงทะเบียนบริษัทใหม่ — reuse RegisterCompanyForm ตัวเดียวกับหน้า public ทั้งหมด (รวม
          validation error สีแดง/กรอบแดงที่มีอยู่แล้วในคอมโพเนนต์นี้) */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        {/* 🛡️ DialogContent กลาง (dialog.tsx) ล็อก sm:max-w-sm ไว้เป็น base class — tailwind-merge ไม่ถือว่า
            max-w-* เฉยๆ (ไม่มี prefix) ชนกับ sm:max-w-* เลยปล่อยทั้งคู่รอด แล้ว sm: (ถูก Tailwind ประกาศใน
            media query ทีหลัง) จะชนะเสมอที่จอ >=640px ต้องใส่ sm:max-w-* ตรงๆ ถึงจะ override ได้จริง */}
        <DialogContent className="max-w-3xl sm:max-w-2xl rounded-3xl p-8 gap-6">
          <DialogHeader>
            <DialogTitle className="text-xl">สร้างบริษัทใหม่ให้ลูกค้า</DialogTitle>
            <DialogDescription>
              บริษัทที่สร้างจากตรงนี้ใช้งานได้ทันที ไม่ติดโหมดรออนุมัติ
            </DialogDescription>
          </DialogHeader>
          <RegisterCompanyForm submitLabel="สร้างบริษัทใหม่" onSuccess={handleCreateSuccess} />
        </DialogContent>
      </Dialog>

      <AppConfirmDialog
        open={!!companyToApprove}
        onOpenChange={(open) => !open && setCompanyToApprove(null)}
        icon={CheckCircle2}
        iconColorClass="bg-green-50 text-green-600 border-green-100/50"
        title="อนุมัติบริษัทนี้?"
        description={
          <>
            ยืนยันอนุมัติบริษัท <b>{companyToApprove?.name}</b> ใช่หรือไม่? ผู้ดูแลบริษัทนี้จะเข้าสู่ระบบ
            ได้ทันทีหลังอนุมัติ
          </>
        }
        confirmLabel="ยืนยันอนุมัติ"
        confirmColorClass="bg-green-600 hover:bg-green-700 shadow-green-600/20"
        onConfirm={proceedApprove}
        loading={isProcessing}
      />

      <AppConfirmDialog
        open={!!companyToReject}
        onOpenChange={(open) => !open && setCompanyToReject(null)}
        icon={XCircle}
        iconColorClass="bg-red-50 text-red-600 border-red-100/50"
        title="ปฏิเสธบริษัทนี้?"
        description={
          <>
            ยืนยันปฏิเสธบริษัท <b>{companyToReject?.name}</b> ใช่หรือไม่? ข้อมูลบริษัทและบัญชีผู้ดูแลจะถูก
            ลบออกจากระบบถาวร กู้คืนไม่ได้
          </>
        }
        confirmLabel="ยืนยันปฏิเสธ"
        confirmColorClass="bg-red-600 hover:bg-red-700 shadow-red-600/20"
        onConfirm={proceedReject}
        loading={isProcessing}
      />
    </div>
  );
}
