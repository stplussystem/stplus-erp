import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AddProductDialog from "@/components/products/AddProductDialog";
import ProductActions from "@/components/products/ProductActions";
import ProductImageDialog from "@/components/products/ProductImageDialog";
import ProductFilters from "@/components/products/ProductFilters";
// 💡 นำเข้า Component ปุ่ม Excel ที่เราเพิ่งสร้าง
import ProductExcelActions from "@/components/products/ProductExcelActions";

export const dynamic = "force-dynamic";

async function getProducts(search: string, page: string, perPage: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api";
  const fetchUrl = `${apiUrl}/products?search=${encodeURIComponent(search)}&page=${page}&per_page=${perPage}`;

  const res = await fetch(fetchUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await searchParams;

  const search = resolvedParams?.search || "";
  const page = resolvedParams?.page || "1";
  const perPage = resolvedParams?.per_page || "10";

  const response = await getProducts(search, page, perPage);
  const products = response.data || [];
  const meta = response.meta || {};

  return (
    // 💡 ลบ padding ตอนพิมพ์ (print:py-0) ให้เต็มกระดาษ
    <div className="container mx-auto py-8 print:py-0 print:p-0 print:m-0">
      {/* 💡 ซ่อน Header ตอนพิมพ์ */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <h1 className="text-2xl font-bold tracking-tight text-slate-800">
          จัดการสินค้า (Products Master)
        </h1>
        <div className="flex items-center gap-3">
          {/* 💡 นำปุ่ม Import/Export/Print มาวางตรงนี้ */}
          <ProductExcelActions />
          <AddProductDialog />
        </div>
      </div>

      {/* 💡 ซ่อนกล่องค้นหาตอนพิมพ์ */}
      <div className="bg-white p-4 rounded-t-md border border-b-0 flex flex-col gap-4 print:hidden">
        <ProductFilters />
      </div>

      <div className="border rounded-b-md bg-white overflow-x-auto print:border-none print:shadow-none">
        {/* 💡 ชื่อรายงาน จะโชว์เฉพาะตอนกด Print พิมพ์ลงกระดาษเท่านั้น */}
        <div className="hidden print:block text-center text-xl font-bold mb-4">
          รายงานข้อมูลสินค้า (Products Master)
        </div>

        <Table className="whitespace-nowrap print:text-sm">
          <TableHeader className="bg-slate-50 print:bg-transparent">
            <TableRow>
              {/* 💡 ซ่อนคอลัมน์รูปภาพและปุ่มแก้ไข ตอนพิมพ์ */}
              <TableHead className="w-[80px] text-center print:hidden">
                รูปภาพ
              </TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>บาร์โค้ด</TableHead>
              <TableHead>ชื่อสินค้า</TableHead>
              <TableHead>ยี่ห้อ (Brand)</TableHead>
              <TableHead>รุ่นสินค้า</TableHead>
              <TableHead className="text-right">ราคาขาย</TableHead>
              <TableHead className="text-center">S/N</TableHead>
              <TableHead className="w-[100px] text-center print:hidden">
                แก้ไข
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-10 text-slate-500"
                >
                  ไม่พบข้อมูลสินค้า...
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: any) => (
                <TableRow
                  key={product.id}
                  className="hover:bg-slate-50 print:border-b"
                >
                  <TableCell className="text-center print:hidden">
                    <ProductImageDialog
                      imageUrl={product.image_url}
                      productName={product.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {product.barcode || "-"}
                  </TableCell>
                  <TableCell>{product.name}</TableCell>
                  <TableCell>{product.brand?.name || "-"}</TableCell>
                  <TableCell>{product.model_name || "-"}</TableCell>
                  <TableCell className="text-right text-blue-600 font-medium">
                    {product.price.toLocaleString()} ฿
                  </TableCell>
                  <TableCell className="text-center">
                    {product.has_serial_number ? (
                      <Badge
                        variant="default"
                        className="bg-gray-800 print:border print:text-black print:bg-white print:shadow-none"
                      >
                        ต้องระบุ
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-slate-500 print:border print:text-black print:bg-white print:shadow-none"
                      >
                        ไม่ต้องระบุ
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center print:hidden">
                    <ProductActions product={product} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 💡 ซ่อนการแบ่งหน้า ตอนพิมพ์ */}
      {meta.total > 0 && (
        <div className="flex justify-between items-center mt-4 px-2 print:hidden">
          <div className="text-sm text-slate-500">
            แสดง {(meta.current_page - 1) * meta.per_page + 1} ถึง{" "}
            {Math.min(meta.current_page * meta.per_page, meta.total)} จากทั้งหมด{" "}
            {meta.total} รายการ
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.links?.prev}
              asChild
            >
              <Link
                href={
                  meta.links?.prev
                    ? `?search=${search}&per_page=${perPage}&page=${meta.current_page - 1}`
                    : "#"
                }
              >
                ก่อนหน้า
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!meta.links?.next}
              asChild
            >
              <Link
                href={
                  meta.links?.next
                    ? `?search=${search}&per_page=${perPage}&page=${meta.current_page + 1}`
                    : "#"
                }
              >
                ถัดไป
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
