"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  HardHat,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  FileText,
  XCircle,
  Loader2,
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
import { getPaperSizeConfig } from "@/lib/letterLayoutDefaults";

interface WorkOrderItem {
  id?: number;
  description: string;
  quantity: number;
  unit_name: string;
  unit_price: number;
  discount_amount: number;
  total_price: number;
}

const emptyItem = (): WorkOrderItem => ({
  description: "",
  quantity: 1,
  unit_name: "งาน",
  unit_price: 0,
  discount_amount: 0,
  total_price: 0,
});

export default function ContractorWorkOrderEditPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [isAuthorized, setIsAuthorized] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);

  // ✅ ปุ่มอนุมัติสีเขียวในหน้าแก้ไข — แสดงเฉพาะผู้ที่มีสิทธิ์ approve_contractor_work_orders และเอกสารยังรออนุมัติ
  // ถ้ามีการแก้ไขที่ยังไม่บันทึก ปุ่มอนุมัติจะอัปเดตเอกสารให้ก่อน (บันทึกไม่สำเร็จ = ไม่อนุมัติ) ตาม pattern เดียวกับ
  // sales/tax-invoices/[id]/edit
  const canApprove = usePermission("approve_contractor_work_orders");
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const [projects, setProjects] = useState<any[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [creator, setCreator] = useState<any>(null);
  const [approver, setApprover] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    contact_id: "",
    project_id: "",
    rental_job_id: "",
    site_reference: "",
    order_date: dayjs().format("YYYY-MM-DD"),
    discount_amount: 0,
    wht_rate: 0,
    note: "",
    show_footer_note: true,
  });

  const [items, setItems] = useState<WorkOrderItem[]>([emptyItem()]);

  // 🔗 [2026-09-23] "หน่วยงาน (ลูกค้าปลายทาง)" ดึงชื่อลูกค้าจากโครงการที่เลือกมาเติมให้อัตโนมัติ — เก็บค่าที่เติม
  // อัตโนมัติล่าสุดไว้เทียบ ถ้าผู้ใช้ยังไม่ได้แก้ไขเอง (หรือค่าตรงกับที่เติมครั้งก่อน) จึงเติมทับตามโครงการใหม่
  // seed ด้วยค่าที่โหลดมาจากเอกสารเดิมก่อน กันไม่ให้เอฟเฟกต์ทับค่าที่บันทึกไว้แต่แรกตอนโหลดหน้า
  const autoFilledSiteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!formData.project_id || autoFilledSiteRef.current === null) return;
    const project = projects.find((p) => String(p.id) === String(formData.project_id));
    const contactName = project?.contact?.business_name || project?.contact?.contact_name;
    if (!contactName) return;
    if (formData.site_reference === "" || formData.site_reference === autoFilledSiteRef.current) {
      autoFilledSiteRef.current = contactName;
      setFormData((prev) => ({ ...prev, site_reference: contactName }));
    }
  }, [formData.project_id, projects]);

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
          ? p === "edit_contractor_work_orders"
          : p?.name === "edit_contractor_work_orders",
      );

      if (isPlatformAdmin || isSuper || hasPermission) {
        setIsAuthorized(true);
        fetchMasterData();
        fetchOrderData();
      } else {
        toast.error("คุณไม่มีสิทธิ์แก้ไขเอกสาร");
        router.replace("/contractor-work-orders");
      }
    } catch (e) {
      router.replace("/");
    }
  }, [router, orderId]);

  const fetchMasterData = async () => {
    try {
      const token = getToken();
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      };
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const [projectsRes, companyRes] = await Promise.all([
        fetch(`${apiUrl}/projects`, { headers }).catch(() => null),
        fetch(`${apiUrl}/company`, { headers }),
      ]);
      if (projectsRes && projectsRes.ok) {
        const data = await projectsRes.json();
        setProjects(Array.isArray(data) ? data : data?.data || []);
      }
      if (companyRes.ok) {
        const compData = await companyRes.json();
        setCompanySettings(
          Array.isArray(compData) ? compData[0] : compData.data || compData,
        );
      }
    } catch (error) {}
  };

  const fetchOrderData = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/contractor-work-orders/${orderId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        toast.error("ไม่พบข้อมูลใบสั่งจ้าง");
        router.replace("/contractor-work-orders");
        return;
      }
      const order = (await res.json()).data;
      if (order.status === "Cancelled") {
        toast.error("ไม่สามารถแก้ไขได้ เนื่องจากเอกสารนี้ถูกยกเลิกไปแล้ว");
        router.replace("/contractor-work-orders");
        return;
      }
      setIsApproved(order.status === "Approved");
      setOrderNumber(order.order_number);
      setCreator(order.creator);
      setApprover(order.approver);
      setSelectedContact(order.contact);
      autoFilledSiteRef.current = order.site_reference || "";
      setFormData({
        contact_id: order.contact_id?.toString() || "",
        project_id: order.project_id?.toString() || "",
        rental_job_id: order.rental_job_id?.toString() || "",
        site_reference: order.site_reference || "",
        order_date: order.order_date
          ? dayjs(order.order_date).format("YYYY-MM-DD")
          : dayjs().format("YYYY-MM-DD"),
        discount_amount: Number(order.discount_amount) || 0,
        wht_rate: Number(order.wht_rate) || 0,
        note: order.note || "",
        show_footer_note: order.show_footer_note ?? true,
      });
      setItems(
        (order.items || []).map((it: any) => ({
          id: it.id,
          description: it.description,
          quantity: Number(it.quantity),
          unit_name: it.unit_name,
          unit_price: Number(it.unit_price),
          discount_amount: Number(it.discount_amount),
          total_price: Number(it.total_price),
        })),
      );
    } catch (error) {
      toast.error("ข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setFetching(false);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof WorkOrderItem,
    value: string | number,
  ) => {
    const newItems = [...items];
    const val =
      field === "description" || field === "unit_name"
        ? value
        : Number(value) || 0;
    newItems[index] = { ...newItems[index], [field]: val } as WorkOrderItem;
    newItems[index].total_price =
      newItems[index].quantity * newItems[index].unit_price -
      newItems[index].discount_amount;
    setItems(newItems);
  };

  const finance = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.total_price, 0);
    const discount = Number(formData.discount_amount) || 0;
    const afterDiscount = Math.max(0, subtotal - discount);
    const whtRate = Number(formData.wht_rate) || 0;
    const whtAmount =
      whtRate > 0 ? Math.round(afterDiscount * (whtRate / 100) * 100) / 100 : 0;
    const grandTotal = Math.max(0, afterDiscount - whtAmount);
    return { subtotal, discount, afterDiscount, whtAmount, grandTotal };
  }, [items, formData.discount_amount, formData.wht_rate]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contact_id)
      newErrors.contact_id = "กรุณาเลือกผู้รับเหมา/ช่าง";
    if (items.some((i) => !i.description.trim()))
      newErrors.items = "กรุณาระบุรายละเอียดงานให้ครบทุกแถว";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const currentSnapshot = useMemo(
    () => JSON.stringify({ formData, items }),
    [formData, items],
  );
  const hasUnsavedChanges = savedSnapshot !== "" && savedSnapshot !== currentSnapshot;

  useEffect(() => {
    if (!fetching && savedSnapshot === "") setSavedSnapshot(currentSnapshot);
  }, [fetching, savedSnapshot, currentSnapshot]);

  const handlePreviewPDF = async () => {
    const toastId = toast.loading("กำลังสร้างตัวอย่างเอกสาร...");
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { default: ContractorWorkOrderPdfTemplate } =
        await import("@/components/documents/ContractorWorkOrderPdfTemplate");
      const pdfDataObj = {
        companySettings,
        formData: { ...formData, creator, approver },
        selectedContact,
        items,
        finance,
        orderNumber,
        ...getPaperSizeConfig(companySettings, "contractor_work_order"),
      };
      const blob = await pdf(
        <ContractorWorkOrderPdfTemplate data={pdfDataObj} />,
      ).toBlob();
      setPreviewUrl(URL.createObjectURL(blob));
      toast.dismiss(toastId);
    } catch (e) {
      toast.error("สร้างตัวอย่าง PDF ไม่สำเร็จ", { id: toastId });
    }
  };

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
        rental_job_id: formData.rental_job_id || null,
        wht_rate: formData.wht_rate || null,
        items,
      };
      const res = await fetch(`${apiUrl}/contractor-work-orders/${orderId}`, {
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
    if (await persist()) router.push("/contractor-work-orders");
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
        const res = await fetch(
          `${apiUrl}/contractor-work-orders/${orderId}/approve`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
          },
        );
        if (!res.ok) {
          toast.error((await res.json()).message || "ไม่สามารถดำเนินการได้", { id: toastId });
          return;
        }
        toast.success("อนุมัติสำเร็จ", { id: toastId });
        setIsApproveOpen(false);
        router.push("/contractor-work-orders");
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
            <h1 className="text-md font-bold tracking-tight">
              แก้ไขใบสั่งจ้าง{" "}
              <span className="text-blue-600">{orderNumber}</span>
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              ระบุรายละเอียดผู้รับเหมาและรายการงาน
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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
          {canApprove && !isApproved && (
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 p-5 border border-border rounded-xl bg-muted/50">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              วันที่ออกเอกสาร
            </label>
            <AppDatePicker
              value={formData.order_date}
              onChange={(v) => setFormData({ ...formData, order_date: v })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              หน่วยงาน (ลูกค้าปลายทาง)
            </label>
            <input
              type="text"
              className="w-full h-10 px-4 rounded-xl border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
              placeholder="เช่น โรงแรมเอเชียแอร์พอร์ท"
              value={formData.site_reference}
              onChange={(e) =>
                setFormData({ ...formData, site_reference: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              โปรเจค (Project)
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
                { value: "__none__", label: "-- ไม่มีโปรเจค --" },
                ...projects.map((pj) => ({
                  value: String(pj.id),
                  label: pj.name,
                })),
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              หัก ณ ที่จ่าย (%)
            </label>
            <AppSelect
              value={String(formData.wht_rate)}
              onValueChange={(v) =>
                setFormData({ ...formData, wht_rate: Number(v) })
              }
              options={[
                { value: "0", label: "ไม่หัก" },
                { value: "1", label: "หัก 1%" },
                { value: "3", label: "หัก 3%" },
                { value: "5", label: "หัก 5%" },
              ]}
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold text-foreground mb-2">
            ผู้รับเหมา/ช่าง <span className="text-red-500">*</span>
          </label>
          <div className="max-w-xl relative z-20">
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
          </div>
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
        <div className="border border-border rounded-2xl overflow-hidden mb-6">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
                <tr>
                  <th className="px-4 py-3 w-10 text-center font-bold">#</th>
                  <th className="px-4 py-3 font-bold min-w-[250px]">
                    รายละเอียดงาน
                  </th>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    จำนวน
                  </th>
                  <th className="px-4 py-3 w-24 text-center font-bold">
                    หน่วย
                  </th>
                  <th className="px-4 py-3 w-32 text-right font-bold">
                    ราคาต่อหน่วย
                  </th>
                  <th className="px-4 py-3 w-28 text-right font-bold">
                    ส่วนลด
                  </th>
                  <th className="px-4 py-3 w-32 text-right font-bold">
                    ราคารวม
                  </th>
                  <th className="px-4 py-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item, index) => (
                  <tr key={index} className="hover:bg-muted/50">
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        placeholder="เช่น Installation สายไฟ สายสัญญาณ งานโครงสร้าง"
                        className="w-full h-10 px-3 border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={item.description}
                        onChange={(e) =>
                          handleItemChange(index, "description", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={item.quantity}
                        onChange={(e) =>
                          handleItemChange(index, "quantity", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        className="w-full h-10 text-center border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={item.unit_name}
                        onChange={(e) =>
                          handleItemChange(index, "unit_name", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        className="w-full h-10 text-right border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        value={item.unit_price}
                        onChange={(e) =>
                          handleItemChange(index, "unit_price", e.target.value)
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        className="w-full h-10 text-right border border-border rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-red-500"
                        value={item.discount_amount}
                        onChange={(e) =>
                          handleItemChange(
                            index,
                            "discount_amount",
                            e.target.value,
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-foreground bg-muted/50">
                      {item.total_price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setItems(items.filter((_, i) => i !== index))
                        }
                        disabled={items.length === 1}
                        className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 border-t border-border bg-muted/50">
            <button
              onClick={() => setItems([...items, emptyItem()])}
              className="text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" /> เพิ่มแถวงาน
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row justify-between gap-8">
          <div className="w-full lg:w-1/2 space-y-4">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">
                หมายเหตุ
              </label>
              <textarea
                rows={4}
                className="w-full p-4 rounded-2xl border border-border outline-none text-sm resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all bg-muted/50 focus:bg-background"
                placeholder="ระบุหมายเหตุเพิ่มเติม..."
                value={formData.note}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value })
                }
              ></textarea>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={formData.show_footer_note}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    show_footer_note: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded border-border"
              />
              แสดงข้อความเงื่อนไขท้ายฟอร์มตอนพิมพ์
            </label>
          </div>
          <div className="w-full lg:w-96 space-y-3 bg-muted/50 p-6 rounded-3xl border border-border text-sm text-muted-foreground shadow-sm">
            <div className="flex justify-between font-medium">
              <span>รวมเป็นเงิน (Subtotal)</span>
              <span>
                {finance.subtotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span>ส่วนลดท้ายบิล</span>
              <input
                type="number"
                min="0"
                className="w-28 h-10 text-right px-2 rounded-xl border border-border text-red-500 font-bold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-background"
                value={formData.discount_amount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount_amount: Number(e.target.value),
                  })
                }
              />
            </div>
            {formData.wht_rate > 0 && (
              <div className="flex justify-between font-medium text-red-500">
                <span>หัก ณ ที่จ่าย ({formData.wht_rate}%)</span>
                <span>
                  -
                  {finance.whtAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-lg font-black text-foreground border-t border-border pt-3 mt-2">
              <span>ยอดเงินสุทธิ</span>
              <span className="text-blue-600">
                {finance.grandTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <AppConfirmDialog
        open={isApproveOpen}
        onOpenChange={setIsApproveOpen}
        icon={CheckCircle2}
        iconColorClass="bg-blue-50 text-blue-600 border-blue-100/50"
        title="อนุมัติใบสั่งจ้าง?"
        description={
          <>
            ยืนยันการอนุมัติใบสั่งจ้างฉบับนี้ใช่หรือไม่?
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

      {previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-card rounded-2xl w-full max-w-4xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex justify-between items-center bg-muted/50">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />{" "}
                พรีวิวตัวอย่างเอกสาร
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
    </div>
  );
}
