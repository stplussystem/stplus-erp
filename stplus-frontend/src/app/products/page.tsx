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
    <div className="w-full max-w-full px-4 md:px-4 py-8 print:py-0 print:p-0 print:m-0 overflow-x-hidden">
      <div className="flex justify-between items-center mb-6 print:hidden">
        {/* 💡 เปลี่ยน text-slate-800 เป็น text-foreground */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          จัดการสินค้า (Products)
        </h1>
        <div className="flex items-center gap-3">
          <ProductExcelActions />
          <AddProductDialog />
        </div>
      </div>

      {/* 💡 เปลี่ยน bg-white เป็น bg-card และแก้สีเส้น border */}
      <div className="bg-card p-4 rounded-t-md border border-border border-b-0 flex flex-col gap-4 print:hidden">
        <ProductFilters />
      </div>

      <div className="border border-border rounded-b-md bg-card overflow-x-auto print:border-none print:shadow-none">
        <div className="hidden print:block text-center text-xl font-bold mb-4">
          รายงานข้อมูลสินค้า (Products)
        </div>

        <Table className="whitespace-nowrap print:text-sm">
          {/* 💡 เปลี่ยนพื้นหลัง Header ให้รองรับ dark mode */}
          <TableHeader className="bg-muted/50 dark:bg-slate-800/50 print:bg-transparent">
            <TableRow>
              <TableHead className="w-[80px] text-center print:hidden text-foreground">
                รูปภาพ
              </TableHead>
              <TableHead className="text-foreground">SKU</TableHead>
              <TableHead className="text-foreground">บาร์โค้ด</TableHead>
              <TableHead className="text-foreground">ชื่อสินค้า</TableHead>
              <TableHead className="text-foreground">ยี่ห้อ (Brand)</TableHead>
              <TableHead className="text-foreground">รุ่นสินค้า</TableHead>
              <TableHead className="text-right text-foreground">
                ราคาขาย
              </TableHead>
              <TableHead className="text-center text-foreground">S/N</TableHead>
              <TableHead className="w-[100px] text-center print:hidden text-foreground">
                แก้ไข
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="text-center py-10 text-muted-foreground"
                >
                  ไม่พบข้อมูลสินค้า...
                </TableCell>
              </TableRow>
            ) : (
              products.map((product: any) => (
                <TableRow
                  key={product.id}
                  className="hover:bg-muted/30 dark:hover:bg-slate-800/30 border-border print:border-b"
                >
                  <TableCell className="text-center print:hidden">
                    <ProductImageDialog
                      imageUrl={product.image_url}
                      productName={product.name}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {product.sku}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.barcode || "-"}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.name}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.brand?.name || "-"}
                  </TableCell>
                  <TableCell className="text-foreground">
                    {product.model_name || "-"}
                  </TableCell>
                  <TableCell className="text-right text-blue-600 dark:text-blue-400 font-bold">
                    {product.price.toLocaleString()} ฿
                  </TableCell>
                  <TableCell className="text-center">
                    {product.has_serial_number ? (
                      <Badge
                        variant="default"
                        className="bg-slate-800 dark:bg-slate-200 dark:text-slate-900"
                      >
                        ต้องระบุ
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-muted-foreground"
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

      {meta.total > 0 && (
        <div className="flex justify-between items-center mt-4 px-2 print:hidden">
          <div className="text-sm text-muted-foreground">
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
              className="cursor-pointer border-border"
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
              className="cursor-pointer border-border"
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
