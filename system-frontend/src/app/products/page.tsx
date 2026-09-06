"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AppSelect } from "@/components/ui/app-select";
import { AppLoading } from "@/components/ui/app-loading";
import { AppPagination } from "@/components/ui/app-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import ProductImageDialog from "@/components/products/ProductImageDialog";
import ProductActions from "@/components/products/ProductActions";
import ProductExcelActions from "@/components/products/ProductExcelActions";
import { ViewSerialsDialog } from "@/components/stock/ViewSerialsDialog";
import { cn } from "@/lib/utils";
import {
  Loader2,
  PackageSearch,
  Plus,
  FilterX,
  RefreshCw,
  Search,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import RoleRouteGuard from "@/components/auth/RoleRouteGuard";
import { getToken } from "@/lib/auth-storage";

function ProductsContent() {
  // กำหนดสิทธิ์ปุ่มต่างๆ
  const canCreatePRO = usePermission("manage_products");
  //--------------------------
  const router = useRouter();
  const searchParams = useSearchParams();
  const search = searchParams.get("search") || "";
  const page = searchParams.get("page") || "1";
  const perPage = searchParams.get("per_page") || "10";

  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [viewSerialProduct, setViewSerialProduct] = useState<any>(null);

  const [searchInput, setSearchInput] = useState(search);
  const [filterType, setFilterType] = useState("all");
  const [filterStock, setFilterStock] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const params = new URLSearchParams();
      if (searchInput) params.append("search", searchInput);
      if (page) params.append("page", page);
      if (perPage) params.append("per_page", perPage);
      if (filterType !== "all") params.append("type", filterType);
      if (filterStock !== "all") params.append("stock_status", filterStock);
      if (filterActive !== "all") params.append("is_active", filterActive);
      if (filterCategory !== "all")
        params.append("category_id", filterCategory);

      const fetchUrl = `${apiUrl}/products?${params.toString()}`;

      const res = await fetch(fetchUrl, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const response = await res.json();
        setProducts(response.data || []);
        setMeta(response.meta || {});
      }
    } catch (error) {
      console.error("Error fetching products inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
      const res = await fetch(`${apiUrl}/product-options`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const response = await res.json();
        setCategories(response.categories || []);
      }
    } catch (error) {
      console.error("Error fetching categories for filter:", error);
    }
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setFilterType("all");
    setFilterStock("all");
    setFilterActive("all");
    setFilterCategory("all");
    router.push("?");
  };

  const handleToggleActive = async (
    productId: number,
    currentStatus: number,
  ) => {
    const newStatus = currentStatus === 1 ? 0 : 1;

    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId ? { ...p, is_active: newStatus } : p,
      ),
    );

    try {
      const token = getToken();
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";

      const res = await fetch(`${apiUrl}/products/${productId}/toggle-active`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");

      toast.success(
        newStatus === 1 ? "เปิดใช้งานสินค้าแล้ว" : "ปิดการใช้งานสินค้าแล้ว",
      );
    } catch (error) {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, is_active: currentStatus } : p,
        ),
      );
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [
    search,
    page,
    perPage,
    filterType,
    filterStock,
    filterActive,
    filterCategory,
  ]);

  useEffect(() => {
    fetchCategories();
    const handleRefresh = () => fetchInventory();
    window.addEventListener("refreshProducts", handleRefresh);
    return () => window.removeEventListener("refreshProducts", handleRefresh);
  }, []);

  return (
    <div className="w-full max-w-full px-4 py-4 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 print:hidden gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight">
              จัดการสินค้าและคลังสินค้า (Products & Inventory)
            </h1>
            <p className="text-slate-500 text-[11px] mt-0.5">
              ตรวจสอบสถานะสต็อก จำนวนคงเหลือ ข้อมูล S/N
              และนำเข้าส่งออกข้อมูลผ่าน Excel ได้ในที่เดียว
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProductExcelActions
            filters={{
              search: searchInput,
              type: filterType,
              stock: filterStock,
              active: filterActive,
              category: filterCategory,
            }}
          />
          {canCreatePRO && (
            <Link href="/products/create">
              <Button className="flex justify-center h-10 px-5 py-2 w-full md:w-auto gap-2 text-sm font-medium items-center text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/20 rounded-full cursor-pointer transition-all hover:scale-102 transition-transform disabled:opacity-50">
                <Plus className="w-4 h-4" /> เพิ่มสินค้าใหม่
              </Button>
            </Link>
          )}
        </div>
      </div>

      <div className="bg-card p-4 rounded-t-md border border-border border-b-0 flex flex-col xl:flex-row xl:items-center gap-4 print:hidden">
        <div className="relative w-full xl:w-100">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="ค้นหา SKU, ชื่อสินค้า, บาร์โค้ด..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchInventory()}
            className="pl-9 h-11 bg-slate-50/50 border-slate-200 rounded-full text-sm"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 w-full xl:w-auto">
          <AppSelect
            value={filterType}
            onValueChange={setFilterType}
            placeholder="ประเภทสินค้า"
            triggerClassName="h-11 rounded-full bg-slate-50/50 min-w-[150px] text-xs font-semibold text-slate-700"
            options={[
              { value: "all", label: "ประเภท: ทั้งหมด" },
              { value: "inventory", label: " สินค้าสำหรับขาย" },
              { value: "rent", label: " สินค้าสำหรับเช่า" },
              { value: "install", label: " สินค้าสำหรับงานติดตั้ง" },
              { value: "service", label: " บริการ" },
            ]}
          />

          <AppSelect
            value={filterStock}
            onValueChange={setFilterStock}
            placeholder="สถานะสต็อก"
            triggerClassName="h-11 rounded-full bg-slate-50/50 min-w-[140px] text-xs font-semibold text-slate-700"
            options={[
              { value: "all", label: "สต็อก: ทั้งหมด" },
              { value: "in_stock", label: " มีในสต็อก" },
              { value: "out_of_stock", label: " สินค้าหมด" },
            ]}
          />

          <AppSelect
            value={filterActive}
            onValueChange={setFilterActive}
            placeholder="การใช้งาน"
            triggerClassName="h-11 rounded-full bg-slate-50/50 min-w-[140px] text-xs font-semibold text-slate-700"
            options={[
              { value: "all", label: "สถานะ: ทั้งหมด" },
              { value: "active", label: " ใช้งานอยู่" },
              { value: "inactive", label: " ไม่ได้ใช้งาน" },
            ]}
          />

          <AppSelect
            value={filterCategory}
            onValueChange={setFilterCategory}
            placeholder="หมวดหมู่สินค้า"
            triggerClassName="h-11 rounded-full bg-slate-50/50 min-w-[160px] text-xs font-semibold text-slate-700"
            contentClassName="max-h-[300px]"
            options={[
              { value: "all", label: "หมวดหมู่: ทั้งหมด" },
              ...categories.map((cat: any) => ({
                value: String(cat.id),
                label: cat.name,
              })),
            ]}
          />
        </div>

        {(searchInput ||
          filterType !== "all" ||
          filterStock !== "all" ||
          filterActive !== "all" ||
          filterCategory !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="rounded-full h-10 px-4 flex items-center gap-2 border border-red-200 bg-red-50 cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-100 transition-colors font-bold text-xs"
          >
            <FilterX className="w-4 h-4" /> ล้างค่า
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={fetchInventory}
          disabled={loading}
          className="xl:ml-auto w-full xl:w-auto rounded-full h-11 px-6 flex items-center gap-2 cursor-pointer shadow-sm border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600"
        >
          <RefreshCw
            className={cn("w-4 h-4", loading && "animate-spin text-blue-600")}
          />
          โหลดข้อมูลล่าสุด
        </Button>
      </div>

      <div className="border border-border rounded-b-md bg-card overflow-x-auto">
        <Table className="whitespace-nowrap">
          <TableHeader className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
            <TableRow>
              <TableHead className="w-[80px] text-center">รูปภาพ</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>บาร์โค้ด</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>ยี่ห้อ (Brand)</TableHead>
              <TableHead className="text-right">ราคาขาย</TableHead>
              <TableHead className="text-center font-bold w-[130px]">
                คงเหลือ
              </TableHead>
              <TableHead className="text-center w-[120px]">สถานะ S/N</TableHead>
              <TableHead className="text-center w-[100px]">สถานะ</TableHead>
              <TableHead className="w-[100px] text-center">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-2" />
                  <p className="text-slate-500 font-medium text-xs">
                    กำลังดึงข้อมูลสินค้าคงคลังล่าสุด...
                  </p>
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center py-20 text-slate-400 text-sm"
                >
                  ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขการค้นหา
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: any) => {
                const qty =
                  product.stockBalance?.qty ?? product.stock_balance?.qty ?? 0;
                const threshold = product.low_stock_threshold ?? 0;
                const isLowStock = threshold > 0 && qty <= threshold && qty > 0;

                // 🚀 เช็คสถานะแบบยืดหยุ่นสูง ป้องกันบั๊ก Type Strict และกรณี undefined
                const isActive =
                  product.is_active === undefined
                    ? true
                    : product.is_active == 1 || product.is_active === true;

                return (
                  <TableRow
                    key={product.id}
                    className={cn(
                      "hover:bg-muted/30 border-border transition-colors",
                      !isActive && "opacity-50 grayscale bg-slate-50",
                    )}
                  >
                    <TableCell className="text-center">
                      <ProductImageDialog
                        imageUrl={product.image_url}
                        productName={product.name}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-xs text-slate-800">
                      {product.sku}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {product.barcode || "-"}
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-700">
                      {product.name}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {product.brand?.name || "-"}
                    </TableCell>
                    <TableCell className="text-right text-blue-600 font-bold text-xs">
                      {product.price.toLocaleString()} ฿
                    </TableCell>

                    <TableCell className="text-center font-bold text-xs">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-md transition-colors font-semibold",
                          qty === 0
                            ? "text-slate-400 bg-red-50 dark:bg-red-900/20"
                            : isLowStock
                              ? "text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                              : "text-slate-900 dark:text-slate-100",
                        )}
                      >
                        {qty.toLocaleString()} ชิ้น
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      {product.has_serial_number ? (
                        <div
                          onClick={() => setViewSerialProduct(product)}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-800 transition-all shadow-sm"
                        >
                          <Search className="w-3.5 h-3.5" /> ดู{" "}
                          {product.available_serials_count ?? 0} S/N
                        </div>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-slate-400 bg-slate-50 text-[10px] border-none"
                        >
                          ไม่มี S/N
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <Switch
                        checked={isActive}
                        onCheckedChange={() =>
                          handleToggleActive(product.id, isActive ? 1 : 0)
                        }
                        className="data-[state=checked]:bg-green-500"
                      />
                    </TableCell>

                    <TableCell className="text-center">
                      <ProductActions product={product} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <AppPagination
        currentPage={meta.current_page || 1}
        lastPage={meta.last_page || 1}
        total={meta.total || 0}
        perPage={meta.per_page || 15}
        onPageChange={(p) =>
          router.push(
            `?page=${p}&search=${search}&per_page=${perPage}&type=${filterType}&stock_status=${filterStock}&is_active=${filterActive}&category_id=${filterCategory}`,
          )
        }
      />

      {viewSerialProduct && (
        <ViewSerialsDialog
          isOpen={!!viewSerialProduct}
          onClose={() => setViewSerialProduct(null)}
          productId={viewSerialProduct.id}
          productName={viewSerialProduct.name}
          sku={viewSerialProduct.sku}
        />
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<AppLoading />}>
      {/* เอา Component ส่วนกลางมาครอบระบุสิทธิ์ จบเลย! ไม่ต้องมี useEffect ดักเตะในหน้านี้อีกต่อไป */}
      <RoleRouteGuard permission="view_products">
        <ProductsContent />
      </RoleRouteGuard>
    </Suspense>
  );
}
