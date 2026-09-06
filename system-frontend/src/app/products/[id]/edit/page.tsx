"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { AppLoading } from "@/components/ui/app-loading";
import {
  ArrowLeft,
  Plus,
  ImagePlus,
  X,
  ChevronsUpDown,
  Check,
  Package,
  Briefcase,
  Box,
  CalendarDays,
  BellRing,
  Save,
  Loader2,
  Wrench,
  ScanLine,
  Link2,
  PackagePlus,
  Trash2,
} from "lucide-react";
import { withToastPromise } from "@/lib/toast-helper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";

function EditProductPageContent() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id;

  const [loading, setLoading] = useState(false);
  const [fetchingProduct, setFetchingProduct] = useState(true);
  const [product, setProduct] = useState<any>(null);

  const [productType, setProductType] = useState("inventory");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [hasSerialNumber, setHasSerialNumber] = useState(false);
  const [priceInput, setPriceInput] = useState("0");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [masterData, setMasterData] = useState({
    brands: [],
    categories: [],
    units: [],
  });

  const [openBrand, setOpenBrand] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [searchBrand, setSearchBrand] = useState("");

  const [openCategory, setOpenCategory] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchCategory, setSearchCategory] = useState("");

  const [openUnit, setOpenUnit] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [searchUnit, setSearchUnit] = useState("");

  // 🎪 สินค้าที่มักใช้คู่กัน (เช่น เสา Beam คู่กับเสาแกน Beam) — บันทึกทันทีที่กดเพิ่ม/ลบ ไม่ต้องรอกดบันทึกฟอร์มหลัก
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [savingRelated, setSavingRelated] = useState(false);

  // 📦 สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง ประกอบจากสินค้าจริงหลายรายการ ตัดสต๊อกเฉพาะส่วนประกอบตอนอนุมัติเอกสารขาย
  const [bundleItems, setBundleItems] = useState<
    {
      component_product_id: string;
      component_name: string;
      component_sku: string;
      quantity: number;
    }[]
  >([]);

  useEffect(() => {
    // 1. โหลด Master Data
    apiFetch(`/product-options`)
      .then((data) => {
        if (data && data.categories) setMasterData(data);
      })
      .catch((err) => console.error("โหลดข้อมูลล้มเหลว:", err));

    // 2. โหลดข้อมูลสินค้าตัวนี้
    apiFetch(`/products/${productId}`)
      .then((res) => {
        const prod = res.data;
        setProduct(prod);
        // 🐛 แก้บั๊ก: ของเดิมใช้ prod.product_type ตรงๆ ซึ่งเป็นแค่ enum บัญชี (inventory/service/non-inventory)
        // ไม่ได้สะท้อนแท็บที่เลือกจริง (สินค้าเช่า/ติดตั้ง ก็ product_type="inventory" เหมือนกัน) ทำให้แก้ไขสินค้าเช่า/ติดตั้ง
        // แล้วแท็บเด้งไปอยู่ที่ "สินค้าสำหรับขาย" ผิดๆ — ต้องเช็ค can_rent/is_install_job/is_bundle ก่อนเสมอ
        // (ตรงกับ logic ตอน submit ที่แปลง productType กลับเป็น 4 ฟิลด์นี้)
        if (prod.is_bundle) {
          setProductType("bundle");
        } else if (prod.can_rent) {
          setProductType("rent");
        } else if (prod.is_install_job) {
          setProductType("installation");
        } else if (prod.product_type === "service") {
          setProductType("service");
        } else {
          setProductType("inventory");
        }
        if (prod.is_bundle && Array.isArray(prod.bundle_items)) {
          setBundleItems(
            prod.bundle_items.map((bi: any) => ({
              component_product_id: String(bi.component_product_id),
              component_name: bi.component_product?.name || "",
              component_sku: bi.component_product?.sku || "",
              quantity: Number(bi.quantity) || 1,
            })),
          );
        }
        setSelectedBrand(prod.brand?.name || "");
        setSelectedCategory(prod.category?.name || "");
        setSelectedUnit(prod.unit?.name || "");
        setImagePreview(prod.image_url || null);
        setHasSerialNumber(!!prod.has_serial_number);
        setLowStockThreshold(
          prod.low_stock_threshold !== undefined &&
            prod.low_stock_threshold !== null
            ? Number(prod.low_stock_threshold)
            : 5,
        );
        if (prod.price) {
          const parts = prod.price.toString().split(".");
          parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
          setPriceInput(parts.join("."));
        }
      })
      .catch((err) => {
        toast.error("ไม่พบข้อมูลสินค้า");
        router.push("/products");
      })
      .finally(() => setFetchingProduct(false));

    // 3. โหลดสินค้าที่มักใช้คู่กัน
    apiFetch(`/products/${productId}/related`)
      .then((res) => setRelatedProducts(res.data || []))
      .catch((err) => console.error("โหลดสินค้าคู่กันไม่สำเร็จ:", err));
  }, [productId, router]);

  const saveRelatedProducts = async (nextList: any[]) => {
    setSavingRelated(true);
    try {
      const res = await apiFetch(`/products/${productId}/related`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          related_product_ids: nextList.map((p) => p.id),
        }),
      });
      setRelatedProducts(res.data || nextList);
    } catch (error) {
      toast.error("บันทึกสินค้าที่มักใช้คู่กันไม่สำเร็จ");
    } finally {
      setSavingRelated(false);
    }
  };

  const addRelatedProduct = (productIdToAdd: string, productData: any) => {
    if (relatedProducts.some((p) => p.id === Number(productIdToAdd))) return;
    if (Number(productIdToAdd) === Number(productId)) {
      toast.error("ไม่สามารถเลือกสินค้าตัวเองเป็นสินค้าคู่กันได้");
      return;
    }
    const nextList = [
      ...relatedProducts,
      {
        id: Number(productIdToAdd),
        name: productData.name,
        sku: productData.sku,
      },
    ];
    saveRelatedProducts(nextList);
  };

  const removeRelatedProduct = (relatedId: number) => {
    saveRelatedProducts(relatedProducts.filter((p) => p.id !== relatedId));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast.error("ไฟล์รูปภาพมีขนาดใหญ่เกินไป", {
        description: "กรุณาอัปโหลดไฟล์ขนาดไม่เกิน 500 KB ครับ",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddNewItem = async (
    typeLabel: string,
    typeKey: "brand" | "category" | "unit",
    name: string,
  ) => {
    if (!name) return;
    try {
      const result = await apiFetch(`/master-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: typeKey, name }),
      });
      setMasterData((prev: any) => {
        const key =
          typeKey === "brand"
            ? "brands"
            : typeKey === "category"
              ? "categories"
              : "units";
        return { ...prev, [key]: [...(prev[key] || []), result.data] };
      });

      if (typeKey === "brand") {
        setSelectedBrand(result.data.name);
        setOpenBrand(false);
      }
      if (typeKey === "category") {
        setSelectedCategory(result.data.name);
        setOpenCategory(false);
      }
      if (typeKey === "unit") {
        setSelectedUnit(result.data.name);
        setOpenUnit(false);
      }
      toast.success(`เพิ่ม${typeLabel} "${name}" เรียบร้อยแล้ว`);
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาดในการเพิ่ม${typeLabel}`);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^\d.]/g, "");
    const parts = rawValue.split(".");
    if (parts.length > 2) parts.pop();
    if (parts[0]) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setPriceInput(parts.join("."));
    setErrors((prev) => ({ ...prev, price: "" }));
  };

  const validate = (formData: FormData) => {
    const newErrors: Record<string, string> = {};
    if (!formData.get("name")) newErrors.name = "กรุณากรอกชื่อสินค้า";
    if (!formData.get("sku")) newErrors.sku = "กรุณากรอกรหัสสินค้า";
    if (!priceInput || Number(priceInput.replace(/,/g, "")) <= 0)
      newErrors.price = "กรุณากรอกราคาสินค้า";
    if (!selectedCategory) newErrors.category = "กรุณาเลือกหมวดหมู่สินค้า";
    if (!selectedUnit) newErrors.unit = "กรุณาเลือกหน่วยนับ";
    if (productType === "bundle" && bundleItems.length === 0)
      newErrors.bundleItems =
        "กรุณาเพิ่มส่วนประกอบของสินค้าชุดอย่างน้อย 1 รายการ";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formElement = e.currentTarget;
    const formData = new FormData(formElement);

    if (!validate(formData)) {
      toast.error("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    setLoading(true);

    formData.append("_method", "PUT");
    // 📦 ค่าเริ่มต้น is_bundle=0 เสมอ — จะถูกเซ็ตเป็น 1 เฉพาะ branch "bundle" ด้านล่าง (กันกรณีสลับออกจากสินค้าชุดแล้วค่าเก่าค้าง)
    formData.set("is_bundle", "0");
    // 🚀 แปลงร่าง productType (ที่เลือกจากหน้าเว็บ) เป็น 4 ฟิลด์ตามมาตรฐานบัญชีของเรา!
    if (productType === "inventory") {
      formData.append("product_type", "inventory");
      formData.append("can_sell", "1");
      formData.append("can_rent", "0");
      formData.append("is_install_job", "0");
    } else if (productType === "rent") {
      formData.append("product_type", "inventory"); // 📦 เช่าต้องตัดสต็อก
      formData.append("can_sell", "0");
      formData.append("can_rent", "1");
      formData.append("is_install_job", "0");
    } else if (productType === "installation") {
      // 💡 ในโค้ดพี่เคใช้ value="installation"
      formData.append("product_type", "inventory"); // 📦 ติดตั้งต้องตัดสต็อก
      formData.append("can_sell", "0");
      formData.append("can_rent", "0");
      formData.append("is_install_job", "1");
    } else if (productType === "service") {
      formData.append("product_type", "service"); // 🛠️ บริการไม่มีสต็อก
      formData.append("can_sell", "1");
      formData.append("can_rent", "0");
      formData.append("is_install_job", "0");
    } else if (productType === "bundle") {
      // 📦 สินค้าชุด — ไม่มีสต๊อกของตัวเอง (backend บังคับ non-inventory ซ้ำอีกชั้นด้วย)
      formData.append("product_type", "non-inventory");
      formData.append("can_sell", "1");
      formData.append("can_rent", "0");
      formData.append("is_install_job", "0");
      formData.set("is_bundle", "1");
      bundleItems.forEach((bi, index) => {
        formData.append(
          `bundle_items[${index}][component_product_id]`,
          bi.component_product_id,
        );
        formData.append(
          `bundle_items[${index}][quantity]`,
          String(bi.quantity),
        );
      });
    }
    // formData.append("product_type", productType);
    formData.append("low_stock_threshold", lowStockThreshold.toString());
    formData.set("price", priceInput.replace(/,/g, ""));

    const brandId = masterData.brands?.find(
      (b: any) => b.name === selectedBrand,
    )?.id;
    if (brandId) formData.append("brand_id", brandId);

    const catId = masterData.categories?.find(
      (c: any) => c.name === selectedCategory,
    )?.id;
    if (catId) formData.append("category_id", catId);

    const unitId = masterData.units?.find(
      (u: any) => u.name === selectedUnit,
    )?.id;
    if (unitId) formData.append("unit_id", unitId);

    // 🚀 S/N ใช้ค่าจาก Switch โดยตรง (Inventory & Rent เท่านั้น)
    const isSnEligible = productType === "inventory" || productType === "rent";
    formData.set(
      "has_serial_number",
      isSnEligible && hasSerialNumber ? "1" : "0",
    );

    const savePromise = apiFetch(`/products/${productId}`, {
      method: "POST", // อัปโหลดไฟล์ใช้ POST คู่กับ _method=PUT
      body: formData,
    }).finally(() => setLoading(false));

    withToastPromise(savePromise, {
      loading: "กำลังบันทึกข้อมูล...",
      success: "อัปเดตข้อมูลสินค้าสำเร็จ!",
      error: (err) => `บันทึกไม่สำเร็จ: ${err.message}`,
      onSuccessCallback: () => {
        router.push("/products");
      },
    });
  };

  if (fetchingProduct) {
    return (
      <AppLoading text="กำลังโหลดข้อมูลสินค้า..." minHeight="min-h-[60vh]" />
    );
  }

  // ล็อคไม่ให้แก้ S/N ถ้าสินค้ามีการเคลื่อนไหวไปแล้ว
  const isSnLocked =
    !!product?.has_movements || (product?.stock_balance?.qty || 0) > 0;

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      {/* ส่วนหัว */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              แก้ไขข้อมูลสินค้า
            </h1>
            <p className="text-muted-foreground text-[11px] mt-0.5">
              รหัสอ้างอิง:{" "}
              <span className="font-bold text-blue-600">{product?.sku}</span>
            </p>
          </div>
        </div>
        <Link href="/products">
          <button
            type="button"
            className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
          >
            <ArrowLeft className="w-5 h-5" /> ย้อนกลับ
          </button>
        </Link>
      </div>

      <div className="bg-white dark:bg-slate-900 shadow-sm border border-border dark:border-slate-800 rounded-3xl p-6 md:p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-8">
          {/* 🚀 ปรับ Radio Group ให้เหลือ 4 คอลัมน์ ตามหน้า Create ล่าสุด */}
          <div className="bg-muted/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-border dark:border-slate-800">
            <RadioGroup
              value={productType}
              onValueChange={setProductType}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "inventory"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-border dark:border-slate-800 grayscale opacity-60",
                )}
              >
                <RadioGroupItem value="inventory" id="type-inventory" />
                <Label
                  htmlFor="type-inventory"
                  className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm"
                >
                  <Box className="h-4 w-4 text-blue-500 shrink-0" />{" "}
                  สินค้าสำหรับขาย
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "rent"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-border dark:border-slate-800 grayscale opacity-60",
                )}
              >
                <RadioGroupItem value="rent" id="type-rent" />
                <Label
                  htmlFor="type-rent"
                  className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm"
                >
                  <CalendarDays className="h-4 w-4 text-blue-500 shrink-0" />{" "}
                  สินค้าสำหรับเช่า
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "installation"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-border dark:border-slate-800 grayscale opacity-60",
                )}
              >
                <RadioGroupItem value="installation" id="type-installation" />
                <Label
                  htmlFor="type-installation"
                  className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm"
                >
                  <Wrench className="h-4 w-4 text-blue-500 shrink-0" />{" "}
                  สินค้าสำหรับงานติดตั้ง
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "service"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-border dark:border-slate-800 grayscale opacity-60",
                )}
              >
                <RadioGroupItem value="service" id="type-service" />
                <Label
                  htmlFor="type-service"
                  className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm"
                >
                  <Briefcase className="h-4 w-4 text-blue-500 shrink-0" />{" "}
                  บริการ
                </Label>
              </div>

              {/* 📦 สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง ประกอบจากสินค้าจริงหลายรายการ */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "bundle"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-border dark:border-slate-800 grayscale opacity-60",
                )}
              >
                <RadioGroupItem value="bundle" id="type-bundle" />
                <Label
                  htmlFor="type-bundle"
                  className="flex items-center gap-2 cursor-pointer w-full font-bold text-sm"
                >
                  <PackagePlus className="h-4 w-4 text-blue-500 shrink-0" />{" "}
                  สินค้าชุด (Bundle)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* กล่องอัปโหลดรูปภาพ */}
            <div className="xl:col-span-1 flex flex-col gap-3">
              <Label className="font-bold ml-1">รูปภาพสินค้า</Label>
              <div className="relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 bg-muted/50 dark:bg-slate-900 min-h-[250px] transition-all hover:bg-muted dark:hover:bg-slate-800 border-border dark:border-slate-800">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-[210px] w-full object-contain rounded-xl shadow-sm"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-3 -right-3 h-8 w-8 rounded-full shadow-lg"
                      onClick={removeImage}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <div
                    className="text-center cursor-pointer p-6"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 border border-border dark:border-slate-700">
                      <ImagePlus className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-sm text-muted-foreground font-bold">
                      อัปโหลดรูปภาพสินค้า
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-2 font-medium">
                      JPEG, PNG (ไม่เกิน 500 KB)
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  name="image"
                  accept="image/jpeg, image/png, image/webp"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>

            {/* 🚀 กล่องกรอกข้อมูล จัด Layout ให้ตรงกับหน้า Create (md:grid-cols-2) */}
            <div className="xl:col-span-3 flex flex-col gap-6">
              {/* --- แถวที่ 1 --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="name" className="font-bold ml-1">
                    ชื่อสินค้า <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={product?.name}
                    placeholder="ระบุชื่อสินค้าเต็ม"
                    aria-invalid={!!errors.name}
                    onChange={() =>
                      setErrors((prev) => ({ ...prev, name: "" }))
                    }
                    className="h-11 rounded-xl bg-muted/50"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="sku" className="font-bold ml-1">
                    รหัสสินค้า / SKU <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="sku"
                    name="sku"
                    defaultValue={product?.sku}
                    placeholder="ระบุรหัสสินค้า"
                    aria-invalid={!!errors.sku}
                    onChange={() => setErrors((prev) => ({ ...prev, sku: "" }))}
                    className="h-11 rounded-xl bg-muted/50"
                  />
                  {errors.sku && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.sku}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="barcode" className="font-bold ml-1">
                    บาร์โค้ด (Barcode)
                  </Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    defaultValue={product?.barcode || ""}
                    placeholder="สแกนบาร์โค้ด..."
                    className="h-11 rounded-xl bg-muted/50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="font-bold ml-1">หมวดหมู่สินค้า</Label>
                  <Popover open={openCategory} onOpenChange={setOpenCategory}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between h-11 px-4 rounded-xl font-medium bg-muted/50",
                          errors.category &&
                            "border-red-500 ring-2 ring-red-100",
                        )}
                      >
                        {selectedCategory || "ระบุหมวดหมู่"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-border">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหาหมวดหมู่..."
                          onValueChange={setSearchCategory}
                        />
                        <CommandList>
                          <CommandEmpty className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              ไม่พบ "{searchCategory}"
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600 font-bold rounded-lg"
                              onClick={() =>
                                handleAddNewItem(
                                  "หมวดหมู่",
                                  "category",
                                  searchCategory,
                                )
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />{" "}
                              เพิ่มหมวดหมู่ใหม่
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {masterData.categories?.map((cat: any) => (
                              <CommandItem
                                key={cat.id}
                                value={cat.name}
                                onSelect={() => {
                                  setSelectedCategory(cat.name);
                                  setOpenCategory(false);
                                  setErrors((prev) => ({
                                    ...prev,
                                    category: "",
                                  }));
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCategory === cat.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {cat.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {errors.category && (
                    <p className="text-red-500 text-xs font-medium mt-1">
                      {errors.category}
                    </p>
                  )}
                </div>
              </div>

              {/* --- แถวที่ 2 --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="grid gap-2">
                  <Label className="font-bold ml-1">ยี่ห้อ (Brand)</Label>
                  <Popover open={openBrand} onOpenChange={setOpenBrand}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between h-11 px-4 rounded-xl font-medium bg-muted/50"
                      >
                        {selectedBrand || "เลือกยี่ห้อ..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-border">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหายี่ห้อ..."
                          onValueChange={setSearchBrand}
                        />
                        <CommandList>
                          <CommandEmpty className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              ไม่พบ "{searchBrand}"
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600 font-bold rounded-lg"
                              onClick={() =>
                                handleAddNewItem("ยี่ห้อ", "brand", searchBrand)
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" /> เพิ่มยี่ห้อนี้
                            </Button>
                          </CommandEmpty>
                          <CommandGroup>
                            {masterData.brands?.map((brand: any) => (
                              <CommandItem
                                key={brand.id}
                                value={brand.name}
                                onSelect={() => {
                                  setSelectedBrand(brand.name);
                                  setOpenBrand(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedBrand === brand.name
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {brand.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="model_name" className="font-bold ml-1">
                    รุ่นสินค้า (Model)
                  </Label>
                  <Input
                    id="model_name"
                    name="model_name"
                    defaultValue={product?.model_name || ""}
                    placeholder="ระบุรุ่นสินค้า"
                    className="h-11 rounded-xl bg-muted/50"
                  />
                </div>
              </div>

              {/* --- แถวที่ 3 --- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="grid gap-2">
                    <Label className="font-bold ml-1 text-blue-600">
                      ราคามาตรฐาน (฿) <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="price"
                      name="price"
                      type="text"
                      value={priceInput}
                      onChange={handlePriceChange}
                      onFocus={(e) => e.target.select()}
                      aria-invalid={!!errors.price}
                      className="h-11 rounded-xl bg-blue-50/30 border-blue-100 font-bold text-blue-700"
                    />
                    {errors.price && (
                      <p className="text-red-500 text-xs font-medium mt-1">
                        {errors.price}
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="vat_type" className="font-bold ml-1">
                      ภาษีมูลค่าเพิ่ม <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      name="vat_type"
                      defaultValue={product?.vat_type || "7"}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-muted/50 cursor-pointer p-5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="7">
                          ราคายังไม่รวม VAT (7%)
                        </SelectItem>
                        <SelectItem value="0">VAT 0%</SelectItem>
                        <SelectItem value="exempt">ยกเว้นภาษี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="grid gap-2">
                    <Label className="font-bold ml-1">
                      หน่วยนับ <span className="text-red-500">*</span>
                    </Label>
                    <Popover open={openUnit} onOpenChange={setOpenUnit}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn(
                            "w-full justify-between h-11 px-4 rounded-xl font-medium bg-muted/50",
                            errors.unit && "border-red-500 ring-2 ring-red-100",
                          )}
                        >
                          {selectedUnit || "ระบุหน่วย"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-border">
                        <Command>
                          <CommandInput
                            placeholder="ค้นหาหน่วย..."
                            onValueChange={setSearchUnit}
                          />
                          <CommandList>
                            <CommandEmpty className="p-4 text-center">
                              <p className="text-sm text-muted-foreground mb-3">
                                ไม่พบ "{searchUnit}"
                              </p>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full text-blue-600 font-bold rounded-lg"
                                onClick={() =>
                                  handleAddNewItem(
                                    "หน่วยนับ",
                                    "unit",
                                    searchUnit,
                                  )
                                }
                              >
                                <Plus className="h-4 w-4 mr-1" /> เพิ่มหน่วยใหม่
                              </Button>
                            </CommandEmpty>
                            <CommandGroup>
                              {masterData.units?.map((unit: any) => (
                                <CommandItem
                                  key={unit.id}
                                  value={unit.name}
                                  onSelect={() => {
                                    setSelectedUnit(unit.name);
                                    setOpenUnit(false);
                                    setErrors((prev) => ({
                                      ...prev,
                                      unit: "",
                                    }));
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedUnit === unit.name
                                        ? "opacity-100"
                                        : "opacity-0",
                                    )}
                                  />
                                  {unit.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {errors.unit && (
                      <p className="text-red-500 text-xs font-medium mt-1">
                        {errors.unit}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <Label className="font-bold ml-1 flex items-center gap-1.5">
                      <BellRing className="w-3.5 h-3.5 text-orange-500" />{" "}
                      แจ้งเตือนสต็อกต่ำ
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      value={lowStockThreshold}
                      onChange={(e) =>
                        setLowStockThreshold(parseInt(e.target.value) || 0)
                      }
                      className="h-11 rounded-xl bg-orange-50/20 border-orange-100 font-bold text-orange-600"
                    />
                  </div>
                </div>
              </div>

              {/* 🚀 ระบบ S/N: เฉพาะสินค้าขายและสินค้าเช่า */}
              {(productType === "inventory" || productType === "rent") && (
                <>
                  <hr className="my-2 border-border dark:border-slate-800" />
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 p-5 rounded-2xl border-2 mt-2 w-full md:w-1/3 transition-colors",
                      hasSerialNumber
                        ? "bg-red-50 border-red-200"
                        : "bg-muted/50 border-border",
                      isSnLocked && "opacity-70",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          hasSerialNumber
                            ? "bg-red-200 text-red-600"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <ScanLine className="w-5 h-5" />
                      </div>
                      <div>
                        <Label
                          htmlFor="has_serial_number"
                          className={cn(
                            "font-bold text-xs",
                            isSnLocked
                              ? "cursor-not-allowed"
                              : "cursor-pointer",
                          )}
                        >
                          ระบบ Serial Number (S/N)
                        </Label>
                        <p
                          className={cn(
                            "text-md font-bold mt-0.5",
                            hasSerialNumber
                              ? "text-red-500"
                              : "text-muted-foreground",
                          )}
                        >
                          {hasSerialNumber
                            ? "สินค้าต้องระบุ S/N"
                            : "สินค้าไม่ต้องระบุ S/N"}
                        </p>
                        {isSnLocked && (
                          <p className="text-[10px] text-red-500 font-bold mt-1 leading-relaxed">
                            🔒 สินค้ามีประวัติการทำรายการหรือมีสต็อกคงเหลือแล้ว
                            ไม่สามารถแก้ไข S/N ได้
                          </p>
                        )}
                      </div>
                    </div>
                    <Switch
                      id="has_serial_number"
                      checked={hasSerialNumber}
                      disabled={isSnLocked}
                      onCheckedChange={setHasSerialNumber}
                      className="
                        data-[state=checked]:bg-red-500
                        data-[state=checked]:hover:bg-red-600
                        data-[state=unchecked]:bg-slate-300
                        cursor-pointer
                        disabled:cursor-not-allowed
                      "
                    />
                  </div>
                </>
              )}

              {/* 📦 สินค้าชุด (Bundle) — เพิ่ม/ลบส่วนประกอบที่จะถูกตัดสต๊อกจริงตอนอนุมัติเอกสารขาย */}
              {productType === "bundle" && (
                <>
                  <hr className="my-2 border-border dark:border-slate-800" />
                  <div className="grid gap-2">
                    <Label className="font-bold ml-1 flex items-center gap-1.5">
                      <PackagePlus className="w-3.5 h-3.5 text-blue-500" />{" "}
                      ส่วนประกอบของสินค้าชุด{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="border border-border dark:border-slate-800 rounded-2xl overflow-hidden">
                      {bundleItems.length > 0 && (
                        <div className="divide-y divide-border dark:divide-slate-800">
                          {bundleItems.map((bi, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-3 p-3"
                            >
                              <div className="flex-1">
                                <ProductSearchDropdown
                                  value={bi.component_product_id}
                                  selectedSku={bi.component_sku}
                                  selectedName={bi.component_name}
                                  onChange={(val, productData) => {
                                    setBundleItems((prev) =>
                                      prev.map((it, i) =>
                                        i === index
                                          ? {
                                              ...it,
                                              component_product_id: val,
                                              component_name: productData.name,
                                              component_sku: productData.sku,
                                            }
                                          : it,
                                      ),
                                    );
                                    setErrors((prev) => ({
                                      ...prev,
                                      bundleItems: "",
                                    }));
                                  }}
                                />
                              </div>
                              <Input
                                type="number"
                                min="0.01"
                                step="any"
                                value={bi.quantity}
                                onChange={(e) =>
                                  setBundleItems((prev) =>
                                    prev.map((it, i) =>
                                      i === index
                                        ? {
                                            ...it,
                                            quantity:
                                              Number(e.target.value) || 0,
                                          }
                                        : it,
                                    ),
                                  )
                                }
                                className="h-11 w-24 rounded-xl bg-muted/50 text-center"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBundleItems((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  )
                                }
                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t border-border dark:border-slate-800 bg-muted/50 dark:bg-slate-900/50">
                        <button
                          type="button"
                          onClick={() =>
                            setBundleItems((prev) => [
                              ...prev,
                              {
                                component_product_id: "",
                                component_name: "",
                                component_sku: "",
                                quantity: 1,
                              },
                            ])
                          }
                          className="text-blue-600 text-sm font-bold flex items-center gap-1.5 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors cursor-pointer"
                        >
                          <Plus className="w-4 h-4" /> เพิ่มส่วนประกอบ
                        </button>
                      </div>
                    </div>
                    {errors.bundleItems && (
                      <p className="text-red-500 text-xs font-medium mt-1">
                        {errors.bundleItems}
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* 🎪 สินค้าที่มักใช้คู่กัน */}
              <hr className="my-2 border-border dark:border-slate-800" />
              <div className="space-y-3">
                <Label className="font-bold text-xs flex items-center gap-2 text-foreground">
                  <Link2 className="w-4 h-4 text-blue-500" />{" "}
                  สินค้าที่มักใช้คู่กัน
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  เวลาเลือกสินค้านี้ในใบเบิกสินค้างานเช่า
                  ระบบจะแนะนำให้เพิ่มสินค้าเหล่านี้ด้วย
                </p>
                {relatedProducts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {relatedProducts.map((rp) => (
                      <span
                        key={rp.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full"
                      >
                        {rp.sku ? `[${rp.sku}] ` : ""}
                        {rp.name}
                        <button
                          type="button"
                          disabled={savingRelated}
                          onClick={() => removeRelatedProduct(rp.id)}
                          className="cursor-pointer hover:text-blue-900 disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="w-full md:w-1/2">
                  <ProductSearchDropdown
                    value=""
                    onChange={addRelatedProduct}
                    disabled={savingRelated}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-5 border-t border-border dark:border-slate-800 mt-4">
            <Button
              type="button"
              variant="outline"
              asChild
              className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-foreground bg-background hover:bg-muted border border-border shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
            >
              <Link href="/products">ยกเลิก</Link>
            </Button>
            <Button
              type="submit"
              className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {loading ? "กำลังบันทึก..." : "อัปเดตข้อมูล"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EditProductPage() {
  return (
    <RoleRouteGuard permission="manage_products">
      <EditProductPageContent />
    </RoleRouteGuard>
  );
}
