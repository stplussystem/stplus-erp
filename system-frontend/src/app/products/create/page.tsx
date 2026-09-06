"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppSelect } from "@/components/ui/app-select";
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
  Wrench, // 🚀 เพิ่มไอคอนสำหรับ "งานติดตั้ง"
  ScanLine,
  PackagePlus,
  Trash2,
} from "lucide-react";
import { withToastPromise } from "@/lib/toast-helper";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import { ProductSearchDropdown } from "@/components/products/ProductSearchDropdown";

function CreateProductPageContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 🚀 กำหนดให้ค่าเริ่มต้นเป็น 'inventory' (สินค้ามี Serial Number)
  const [productType, setProductType] = useState("inventory");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [priceInput, setPriceInput] = useState("0");
  const [hasSerialNumber, setHasSerialNumber] = useState(true);
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

  const [vatType, setVatType] = useState("7");

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
    apiFetch(`/product-options`)
      .then((data) => {
        if (data && data.categories) setMasterData(data);
      })
      .catch((err) => console.error("โหลดข้อมูลล้มเหลว:", err));
  }, []);

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
      formData.append("is_bundle", "1");
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
    formData.set("vat_type", vatType);

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

    // 🚀 อนุญาตให้ส่งค่า Serial Number ได้สำหรับสินค้าขายและสินค้าเช่า
    const isSnEligible = productType === "inventory" || productType === "rent";
    const isSn = isSnEligible ? hasSerialNumber : false;
    formData.set("has_serial_number", isSn ? "1" : "0");

    const savePromise = apiFetch(`/products`, {
      method: "POST",
      body: formData,
    }).finally(() => setLoading(false));

    withToastPromise(savePromise, {
      loading: "กำลังบันทึกสินค้าใหม่...",
      success: (res) => `เพิ่มสินค้า ${res.data?.name || ""} เรียบร้อยแล้ว!`,
      error: (err) => `บันทึกไม่สำเร็จ: ${err.message}`,
      onSuccessCallback: () => {
        router.push("/products");
      },
    });
  };

  return (
    <div className="w-full max-w-full px-4 py-4 overflow-x-hidden text-foreground">
      {/* ส่วนหัว */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              สร้างบริการหรือสินค้า
            </h1>
            <p className="text-slate-500 text-[11px]">
              กรอกรายละเอียดเพื่อเพิ่มรายการใหม่เข้าสู่ระบบ
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/products")}
          className="flex justify-center h-10 px-5 py-2  w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับ
        </button>
      </div>
      {/* จบส่วนหัว */}

      <div className="bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8">
        <form onSubmit={onSubmit} className="flex flex-col gap-8">
          {/* ปรับ Radio Group เป็น 5 คอลัมน์ และเปลี่ยนข้อความใหม่ทั้งหมด */}
          <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
            <RadioGroup
              value={productType}
              onValueChange={setProductType}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
            >
              {/* 1. สินค้ามี S/N */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "inventory"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-slate-200 dark:border-slate-800 grayscale opacity-60",
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

              {/* 3. งานเช่า */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "rent"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-slate-200 dark:border-slate-800 grayscale opacity-60",
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

              {/* 4. งานติดตั้ง (ใหม่) */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "installation"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-slate-200 dark:border-slate-800 grayscale opacity-60",
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

              {/* 5. บริการ */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "service"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-slate-200 dark:border-slate-800 grayscale opacity-60",
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

              {/* 6. สินค้าชุด (Bundle) — ไม่มีสต๊อกของตัวเอง ประกอบจากสินค้าจริงหลายรายการ */}
              <div
                className={cn(
                  "flex items-center space-x-3 border p-4 rounded-xl transition-all cursor-pointer hover:border-blue-400",
                  productType === "bundle"
                    ? "bg-blue-100/50 dark:bg-slate-950 border-blue-500 shadow-sm ring-1 ring-blue-500"
                    : "bg-transparent border-slate-200 dark:border-slate-800 grayscale opacity-60",
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

          {/* 🚀 ปรับ Grid ใหญ่: รูปภาพ (1 ส่วน) / ฟอร์ม (3 ส่วน) */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* กล่องอัปโหลดรูปภาพ */}
            <div className="xl:col-span-1 flex flex-col gap-3">
              <Label className="font-bold ml-1">รูปภาพสินค้า</Label>
              <div className="relative border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 min-h-[250px] transition-all hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800">
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
                    <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 border border-slate-100 dark:border-slate-700">
                      <ImagePlus className="h-8 w-8 text-blue-500" />
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-bold">
                      อัปโหลดรูปภาพสินค้า
                    </p>
                    <p className="text-[11px] text-slate-400 mt-2 font-medium">
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

            {/* 🚀 กล่องกรอกข้อมูล (จัดเป็น 3 คอลัมน์ต่อแถว) */}
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
                    placeholder="ระบุชื่อสินค้าเต็ม"
                    aria-invalid={!!errors.name}
                    onChange={() =>
                      setErrors((prev) => ({ ...prev, name: "" }))
                    }
                    className="h-11 rounded-xl bg-slate-50/50"
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
                    placeholder="ระบุรหัสสินค้า"
                    aria-invalid={!!errors.sku}
                    onChange={() => setErrors((prev) => ({ ...prev, sku: "" }))}
                    className="h-11 rounded-xl bg-slate-50/50"
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
                    placeholder="สแกนบาร์โค้ด..."
                    className="h-11 rounded-xl bg-slate-50/50"
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
                          "w-full justify-between h-11 px-4 rounded-xl font-medium bg-slate-50/50",
                          errors.category &&
                            "border-red-500 ring-2 ring-red-100",
                        )}
                      >
                        {selectedCategory || "ระบุหมวดหมู่"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหาหมวดหมู่..."
                          onValueChange={setSearchCategory}
                        />
                        <CommandList>
                          <CommandEmpty className="p-4 text-center">
                            <p className="text-sm text-slate-500 mb-3">
                              ไม่พบ "{searchCategory}"
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600 font-bold rounded-lg cursor-pointer"
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
                        className="w-full justify-between h-11 px-4 rounded-xl font-medium bg-slate-50/50"
                      >
                        {selectedBrand || "เลือกยี่ห้อ..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
                      <Command>
                        <CommandInput
                          placeholder="ค้นหายี่ห้อ..."
                          onValueChange={setSearchBrand}
                        />
                        <CommandList>
                          <CommandEmpty className="p-4 text-center">
                            <p className="text-sm text-slate-500 mb-3">
                              ไม่พบ "{searchBrand}"
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full text-blue-600 font-bold rounded-lg cursor-pointer"
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
                    placeholder="ระบุรุ่นสินค้า"
                    className="h-11 rounded-xl bg-slate-50/50"
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
                    <AppSelect
                      value={vatType}
                      onValueChange={setVatType}
                      triggerClassName="h-11 bg-slate-50/50"
                      options={[
                        { value: "7", label: "ราคารวม VAT (7%)" },
                        { value: "0", label: "ราคายังไม่รวม VAT (0%)" },
                        { value: "exempt", label: "ยกเว้นภาษี" },
                      ]}
                    />
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
                            "w-full justify-between h-11 px-4 rounded-xl font-medium bg-slate-50/50",
                            errors.unit && "border-red-500 ring-2 ring-red-100",
                          )}
                        >
                          {selectedUnit || "ระบุหน่วย"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0 rounded-2xl overflow-hidden shadow-2xl border-slate-200">
                        <Command>
                          <CommandInput
                            placeholder="ค้นหาหน่วย..."
                            onValueChange={setSearchUnit}
                          />
                          <CommandList>
                            <CommandEmpty className="p-4 text-center">
                              <p className="text-sm text-slate-500 mb-3">
                                ไม่พบ "{searchUnit}"
                              </p>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="w-full text-blue-600 font-bold rounded-lg cursor-pointer"
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

              {/* 🚀 ซ่อน/แสดง ระบบ S/N อัตโนมัติตามประเภทที่เลือก */}
              {(productType === "inventory" || productType === "rent") && (
                <>
                  <hr className="my-2 border-slate-200 dark:border-slate-800" />
                  <div
                    className={cn(
                      "flex items-center justify-between gap-3 p-5 rounded-2xl border-2 mt-2 w-full md:w-1/3 transition-colors",

                      hasSerialNumber
                        ? "bg-red-50 border-red-200"
                        : "bg-slate-50 border-slate-200",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "p-2 rounded-lg",
                          hasSerialNumber
                            ? "bg-red-200 text-red-600"
                            : "bg-slate-200 text-slate-500",
                        )}
                      >
                        <ScanLine className="w-5 h-5" />
                      </div>
                      <div>
                        <Label
                          htmlFor="has_serial_number"
                          className="font-bold cursor-pointer text-xs"
                        >
                          ระบบ Serial Number (S/N)
                        </Label>
                        <p
                          className={cn(
                            "text-md font-bold mt-0.5",
                            hasSerialNumber
                              ? "text-red-500"
                              : "text-slate-400 dark:text-slate-500",
                          )}
                        >
                          {hasSerialNumber
                            ? "สินค้าต้องระบุ S/N"
                            : "สินค้าไม่ต้องระบุ S/N"}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id="has_serial_number"
                      checked={hasSerialNumber}
                      onCheckedChange={setHasSerialNumber}
                      className="
    data-[state=checked]:bg-red-500
    data-[state=checked]:hover:bg-red-600
    data-[state=unchecked]:bg-slate-300
    cursor-pointer
  "
                    />
                  </div>
                </>
              )}

              {/* 📦 สินค้าชุด (Bundle) — เพิ่ม/ลบส่วนประกอบที่จะถูกตัดสต๊อกจริงตอนอนุมัติเอกสารขาย */}
              {productType === "bundle" && (
                <>
                  <hr className="my-2 border-slate-200 dark:border-slate-800" />
                  <div className="grid gap-2">
                    <Label className="font-bold ml-1 flex items-center gap-1.5">
                      <PackagePlus className="w-3.5 h-3.5 text-blue-500" />{" "}
                      ส่วนประกอบของสินค้าชุด{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                      {bundleItems.length > 0 && (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
                                className="h-11 w-24 rounded-xl bg-slate-50/50 text-center"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setBundleItems((prev) =>
                                    prev.filter((_, i) => i !== index),
                                  )
                                }
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-5 border-t border-slate-200 dark:border-slate-800 mt-4">
            <Link href="/products" className="w-full md:w-auto">
              <button
                type="button"
                className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 hover:border-slate-300 shadow-sm rounded-full cursor-pointer transition-all hover:scale-102 transition-transform"
              >
                <ArrowLeft className="w-4 h-4" /> ยกเลิก
              </button>
            </Link>
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
              {loading ? "กำลังบันทึก..." : "บันทึกสินค้าใหม่"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateProductPage() {
  return (
    <RoleRouteGuard permission="manage_products">
      <CreateProductPageContent />
    </RoleRouteGuard>
  );
}
