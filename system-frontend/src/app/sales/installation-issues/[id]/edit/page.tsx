"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  HardHat,
  Save,
  ArrowLeft,
  Loader2,
  FileText,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import dayjs from "dayjs";
import { toast } from "sonner";
import { ContactSearchDropdown } from "@/components/contacts/ContactSearchDropdown";
import { getToken, getUserRaw } from "@/lib/auth-storage";
import { AppSelect } from "@/components/ui/app-select";
import { AppDatePicker } from "@/components/ui/app-date-picker";
import { AppLoading } from "@/components/ui/app-loading";
import { AppConfirmDialog } from "@/components/ui/app-confirm-dialog";
import { usePermission } from "@/hooks/usePermission";
import { SaleDocumentItemsTable } from "@/components/sales/SaleDocumentItemsTable";
import { SerialPickerDialog } from "@/components/repairs/SerialPickerDialog";
import { useSaleDocumentItems } from "@/hooks/useSaleDocumentItems";
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

export default function InstallationIssueEditPage() {
  const router = useRouter();
  const params = useParams();
  const documentId = params.id;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // ปุ่มอนุมัติสีเขียว — แสดงเฉพาะผู้ที่มีสิทธิ์ approve_installation_issue (หน้านี้โหลดได้เฉพาะเอกสาร Pending — ถ้าไม่ใช่จะ redirect ออก)
  // ถ้ามีการแก้ไขที่ยังไม่บันทึก ปุ่มอนุมัติจะอัปเดตเอกสารให้ก่อน (บันทึกไม่สำเร็จ = ไม่อนุมัติ)
  const canApprove = usePermission("approve_installation_issue");
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    document_number: "",
    document_type: "installation_issue",
    contact_id: "",
    project_id: "",
    warehouse_id: "",
    issue_date: dayjs().format("YYYY-MM-DD"),
    note: "",
  });

  const {
    items,
    loadFromDocument,
    selectProduct,
    updateItem,
    updateItemSerials,
    addItem,
    removeItem,
    buildPayload,
  } = useSaleDocumentItems(undefined, { unitPriceFollowsCost: true });

  const [serialPickerIndex, setSerialPickerIndex] = useState<number | null>(null);

  useEffect(() => {
    const userStr = getUserRaw();
    if (!userStr) {
      router.replace("/");
      return;
    }
    try {
      const parsedData = JSON.parse(userStr);
      const actualUser = parsedData?.user || parsedData;
      const isPlatformAdmin =
        actualUser?.is_platform_admin === 1 ||
        actualUser?.is_platform_admin === true;
      const roles = Array.isArray(actualUser?.roles) ? actualUser.roles : [];
      const perms = Array.isArray(actualUser?.permissions)
        ? actualUser.permissions
        : [];
      const isSuper = roles.some((role: any) =>
        typeof role === "string"
          ? role.includes("Super Admin")
          : role?.name?.includes("Super Admin"),
      );
      const hasPermission = perms.some((p: any) =>
        typeof p === "string"
          ? p === "edit_installation_issue"
          : p?.name === "edit_installation_issue",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
        fetchDocumentData();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขเอกสาร");
        router.replace("/sales/installation-issues");
      }
    } catch (e) {
      router.replace("/");
    }
  }, [router, documentId]);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [warehousesRes, projectsRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/warehouses`, { headers }),
        fetch(`${apiUrl}/projects`, { headers }).catch(() => null),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (warehousesRes.ok) {
        const wData = await warehousesRes.json();
        setWarehouses(Array.isArray(wData) ? wData : wData?.data || []);
      }
      if (projectsRes && projectsRes.ok) {
        const pData = await projectsRes.json();
        setProjects(Array.isArray(pData) ? pData : pData?.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (error) {}
  };

  const fetchDocumentData = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (res.ok) {
        const doc = (await res.json()).data;
        // 🛡️ backend กัน update() ไว้แล้วถ้า status !== 'Pending' (400) แต่หน้านี้ยังโหลดฟอร์มให้แก้ไขได้เต็มรูปแบบเสมอ
        // ไม่สนสถานะ ผู้ใช้กรอกจนกดบันทึกถึงจะเจอ error — กันตั้งแต่ตรงนี้แทน
        if (doc.status !== "Pending") {
          toast.error("ไม่สามารถแก้ไขเอกสารที่ยืนยันหรือดำเนินการไปแล้วได้", {
            description: "เอกสารนี้ถูกดำเนินการไปแล้ว ไม่สามารถแก้ไขได้อีก",
          });
          router.replace("/sales/installation-issues");
          return;
        }
        setFormData({
          document_number: doc.document_number,
          document_type: doc.document_type,
          contact_id: doc.contact_id?.toString() || "",
          project_id: doc.project_id?.toString() || "",
          warehouse_id: doc.warehouse_id?.toString() || "",
          issue_date: doc.issue_date
            ? dayjs(doc.issue_date).format("YYYY-MM-DD")
            : "",
          note: doc.note || "",
        });
        if (doc.contact) setSelectedContact(doc.contact);
        loadFromDocument(doc.items || []);
      } else {
        toast.error("ไม่พบข้อมูลเอกสาร");
        router.replace("/sales/installation-issues");
      }
    } catch (error) {
      toast.error("ข้อผิดพลาดในการดึงข้อมูล");
    } finally {
      setFetching(false);
    }
  };

  const finance = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.total_price || 0),
      0,
    );
    return {
      subtotal,
      discount: 0,
      after_discount: subtotal,
      vat_amount: 0,
      wht_amount: 0,
      grand_total: subtotal,
      net_payable: subtotal,
    };
  }, [items]);

  const handlePreviewPDF = async () => {
    if (!formData.contact_id) {
      toast.error("กรุณาเลือกลูกค้า");
      return;
    }
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: SalesPdfTemplate } =
        await import("@/components/documents/SalesPdfTemplate");
      const { paperSize, letterLayout } = getPaperSizeConfig(
        companySettings,
        "material_issue",
      );
      const blob = await pdf(
        <SalesPdfTemplate
          data={{
            companySettings,
            formData,
            selectedContact,
            items,
            finance,
            documentNumber: formData.document_number,
            paperSize,
            letterLayout,
          }}
        />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id) newErrors.contact_id = "กรุณาเลือกลูกค้า";
    if (!formData.warehouse_id)
      newErrors.warehouse_id = "กรุณาเลือกคลังสินค้า";
    if (items.length === 0 || items.some((i) => !i.product_id))
      newErrors.items = "กรุณาเลือกสินค้าให้ครบทุกแถว";
    else if (
      items.some(
        (i) => i.has_serial_number && (i.serials?.length || 0) !== i.quantity,
      )
    )
      newErrors.items = "กรุณาเลือก S/N ให้ครบตามจำนวนของสินค้าที่คุม S/N ทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // snapshot เฉพาะค่าที่ผู้ใช้แก้จริง (formData + รายการสินค้า รวม S/N)
  const currentSnapshot = useMemo(
    () => JSON.stringify({ formData, items }),
    [formData, items],
  );
  const hasUnsavedChanges = savedSnapshot !== "" && savedSnapshot !== currentSnapshot;

  // เก็บสแนปช็อตตั้งต้นหลังโหลดเอกสารเสร็จ (รอให้ state ของฟอร์ม/รายการอัปเดตครบก่อน)
  useEffect(() => {
    if (!fetching && savedSnapshot === "") setSavedSnapshot(currentSnapshot);
  }, [fetching, savedSnapshot, currentSnapshot]);

  // บันทึกลง backend (validate + PUT) — คืน true เมื่อสำเร็จ ไม่ redirect (ผู้เรียกตัดสินใจเองว่าจะทำอะไรต่อ)
  const persist = async (): Promise<boolean> => {
    if (!validate()) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return false;
    }
    setLoading(true);
    const toastId = toast.loading("กำลังอัปเดตเอกสาร...");
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const payload = {
        ...formData,
        project_id: formData.project_id || null,
        warehouse_id: formData.warehouse_id || null,
        tax_type: "none",
        items: buildPayload(),
      };
      const res = await fetch(`${apiUrl}/sale-documents/${documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        toast.error("อัปเดตไม่สำเร็จ", {
          id: toastId,
          description: (await res.json()).message,
        });
        return false;
      }
      toast.success("อัปเดตเอกสารสำเร็จ!", { id: toastId });
      setSavedSnapshot(currentSnapshot);
      return true;
    } catch (error) {
      toast.error("ข้อผิดพลาดระบบ", { id: toastId });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (await persist()) router.push("/sales/installation-issues");
  };

  const executeApprove = async () => {
    setIsApproving(true);
    try {
      if (hasUnsavedChanges && !(await persist())) {
        setIsApproveOpen(false);
        return;
      }
      const toastId = toast.loading("กำลังดำเนินการ...");
      try {
        const token = getToken();
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
        const res = await fetch(`${apiUrl}/sale-documents/${documentId}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        });
        if (!res.ok) {
          toast.error((await res.json()).message || "ไม่สามารถดำเนินการได้", { id: toastId });
          return;
        }
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setIsApproveOpen(false);
        router.push("/sales/installation-issues");
      } catch (error) {
        toast.error("ข้อผิดพลาดระบบ", { id: toastId });
      }
    } finally {
      setIsApproving(false);
    }
  };

  if (!isAuthorized) return <AppLoading text="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." variant="bar" minHeight="min-h-screen" className="bg-muted/50" />;

  if (fetching) return <AppLoading text="กำลังโหลดข้อมูลเอกสาร..." minHeight="min-h-screen" />;

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight flex items-center gap-2">
              แก้ไข{" "}
              <span className="text-blue-600">{formData.document_number}</span>
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              แก้ไขรายละเอียดใบเบิกวัสดุติดตั้ง
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            type="button"
            onClick={handlePreviewPDF}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <FileText className="w-4 h-4 text-blue-600" /> ตัวอย่าง PDF
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-4 h-4" /> ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            disabled={loading}
            className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}{" "}
            อัปเดตเอกสาร
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => setIsApproveOpen(true)}
              disabled={loading || isApproving}
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-green-600 hover:bg-green-700 shadow-sm shadow-green-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> อนุมัติเอกสาร
            </button>
          )}
        </div>
      </div>

      <div className="bg-card p-6 rounded-2xl shadow-sm border border-border min-h-[500px]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โครงการ (Project)
            </label>
            <AppSelect
              value={formData.project_id || "__none__"}
              onValueChange={(v) =>
                setFormData({
                  ...formData,
                  project_id: v === "__none__" ? "" : v,
                })
              }
              options={[
                { value: "__none__", label: "-- ไม่ระบุโครงการ --" },
                ...projects
                  .filter(
                    (p) =>
                      p.status !== "completed" ||
                      String(p.id) === formData.project_id,
                  )
                  .map((p) => ({
                    value: String(p.id),
                    label: p.name,
                  })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              คลังสินค้า <span className="text-red-500">*</span>
            </label>
            <AppSelect
              value={formData.warehouse_id || undefined}
              error={!!errors.warehouse_id}
              onValueChange={(v) => {
                setFormData({
                  ...formData,
                  warehouse_id: v,
                });
                setErrors((prev) => ({ ...prev, warehouse_id: "" }));
              }}
              options={warehouses.map((w) => ({
                value: String(w.id),
                label: w.name,
              }))}
            />
            {errors.warehouse_id && (
              <p className="text-red-500 text-xs font-medium mt-1">
                {errors.warehouse_id}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.issue_date}
              onChange={(v) => setFormData({ ...formData, issue_date: v })}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-foreground mb-2">
            เลือกลูกค้า <span className="text-red-500">*</span>
          </label>
          <ContactSearchDropdown
            value={formData.contact_id}
            selectedName={
              selectedContact?.business_name || selectedContact?.name
            }
            selectedCode={selectedContact?.contact_code}
            hasError={!!errors.contact_id}
            onChange={(contactId, contactData) => {
              setFormData({ ...formData, contact_id: contactId });
              setSelectedContact(contactData);
              setErrors((prev) => ({ ...prev, contact_id: "" }));
            }}
          />
          {errors.contact_id && (
            <p className="text-red-500 text-xs font-medium mt-1">
              {errors.contact_id}
            </p>
          )}
        </div>

        {errors.items && (
          <p className="text-red-500 text-xs font-medium mb-2">
            {errors.items}
          </p>
        )}
        <SaleDocumentItemsTable
          items={items}
          hasError={!!errors.items}
          typeFilter="install,service"
          showCostPrice
          // 🆕 [2026-09-18] แถวบริการ (เช่น "ค่าติดตั้ง") ไม่มีต้นทุนถัวเฉลี่ยให้ดึงอัตโนมัติ (ไม่มีสต๊อก) —
          // ต้องให้ผู้ใช้กรอกมูลค่าทุน (ค่าแรง) เองได้ ไม่งั้นรายงานกำไร-ขาดทุนต่อโครงการจะไม่มีค่าบริการเลย
          isCostEditable={(item) => item.product_type === "service"}
          onSelectProduct={(index, productData) => {
            selectProduct(index, productData);
            setErrors((prev) => ({ ...prev, items: "" }));
          }}
          onChangeField={(index, field, value) => updateItem(index, field, value)}
          onAdd={addItem}
          onRemove={removeItem}
          showSerialPicker
          onOpenSerialPicker={(index) => setSerialPickerIndex(index)}
        />

        <div>
          <label className="block text-sm font-bold text-foreground mb-2">
            หมายเหตุ
          </label>
          <textarea
            rows={3}
            className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
            value={formData.note}
            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
          />
        </div>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                พรีวิวตัวอย่างเอกสาร ({formData.document_number})
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
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-xl border border-border"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}

      {serialPickerIndex !== null && (
        <SerialPickerDialog
          isOpen={serialPickerIndex !== null}
          onClose={() => setSerialPickerIndex(null)}
          productId={items[serialPickerIndex].product_id}
          productName={items[serialPickerIndex].product_name}
          quantity={items[serialPickerIndex].quantity}
          value={items[serialPickerIndex].serials || []}
          onConfirm={(serials) => updateItemSerials(serialPickerIndex, serials)}
        />
      )}

      <AppConfirmDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        icon={CheckCircle2}
        iconColorClass="bg-blue-50 text-blue-600 border-blue-100/50"
        title="อนุมัติใบเบิกวัสดุติดตั้ง?"
        description={
          <>
            ระบบจะตัดสต๊อกออกทันทีเมื่ออนุมัติ ยืนยันการอนุมัติใบเบิกวัสดุติดตั้งฉบับนี้ใช่หรือไม่?
            {hasUnsavedChanges && (
              <span className="block mt-2 text-amber-600 font-medium">
                มีการแก้ไขที่ยังไม่ได้บันทึก — ระบบจะอัปเดตเอกสารให้ก่อนอนุมัติ
              </span>
            )}
          </>
        }
        confirmLabel={
          isApproving
            ? "กำลังดำเนินการ..."
            : hasUnsavedChanges
              ? "อัปเดตและอนุมัติ"
              : "อนุมัติเอกสาร"
        }
        confirmColorClass="bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
        onConfirm={executeApprove}
        loading={isApproving}
      />
    </div>
  );
}
