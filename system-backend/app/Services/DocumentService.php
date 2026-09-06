<?php

namespace App\Services;

use App\Models\Company;
use App\Models\DocumentSequence;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DocumentService
{
    // Prefix เริ่มต้นสำหรับ doc type ที่ยังไม่ได้ตั้งค่าไว้ใน company.document_settings
    // (ถ้าใช้ตัวย่อ 2 ตัวแรกของ doc key เฉยๆ จะได้ค่าที่งงๆ เช่น purchase_order -> PU, goods_receipt -> GO)
    private const DEFAULT_PREFIXES = [
        'quotation' => 'QT',
        'custom_quotation' => 'CQT', // ใบเสนอราคาแบบกำหนดเอง (งานเช่า) — แยกจากใบเสนอราคาหลักโดยสิ้นเชิง
        'purchase_order' => 'PO',
        'goods_receipt' => 'GR',
        'goods_receipt_direct' => 'GRD',
        'billing_invoice' => 'BV',
        'tax_invoice' => 'INV',
        'cash' => 'CS',
        'custom_cash' => 'CCS', // บิลเงินสดแบบกำหนดเอง — แยกจากบิลเงินสดหลักโดยสิ้นเชิง เหมือน custom_quotation
        'receipt' => 'RC',
        'credit_note' => 'CN',
        'debit_note' => 'DN',
        'delivery_note' => 'DO',
        'stock_issue' => 'SI', // ใบเบิกสินค้าเช่า (งานเช่า)
        'stock_return' => 'SR', // ใบคืนสินค้า (จากใบลดหนี้)
        'rental_stock_return' => 'SR', // ใบคืนสินค้าเช่า (แยกจาก stock_return แล้ว — เดิม stock_return เคยหมายถึงคืนงานเช่า จึงคงตัวย่อ SR เดิมไว้ที่ตัวนี้)
        'material_issue' => 'MI', // ใบเบิกสินค้า (โครงการขายทั่วไป — ตัดสต๊อกจริง)
        'loan_issue' => 'LN', // ใบยืมสินค้า (ไม่ผูกโครงการ/งานเช่า — จองสต๊อกเหมือนงานเช่า)
        'loan_return' => 'LR', // ใบคืนสินค้ายืม
        'repair_ticket' => 'SV', // Service — เลี่ยง RP ที่คล้าย RC และ RE ที่ซ้ำแนวคิดกับ receipt
        'installation_record' => 'IN', // ไม่ชนกับ INV (tax_invoice) เพราะเป็นคนละ string
        'invoice' => 'IVR', // ใบแจ้งหนี้ — เอกสารแยกใหม่ ไม่ผูกกับสายเอกสารขายเดิม เลี่ยง INV ที่ tax_invoice ใช้อยู่แล้ว
        'contractor_work_order' => 'WO', // ใบสั่งซื้อ/ใบสั่งจ้าง จ้างช่าง/ผู้รับเหมารายตัว — แยกจาก purchase_order (PO) โดยสิ้นเชิง
        'receipt_voucher' => 'RV', // ใบสำคัญรับเงิน — พิมพ์ตอนคืนหลักประกันสัญญาราชการ (ดู GovernmentContractController)
    ];

    /**
     * ฟังก์ชันปั๊มเลขที่เอกสารแบบอัจฉริยะ (รองรับการเปิดย้อนหลัง)
     * * @param string $docKey (เช่น 'quotation', 'purchase_order')
     * @param int $companyId
     * @param string|null $customDate (เช่น '2026-04-15' ถ้าต้องการเปิดย้อนหลัง ถ้าปล่อยว่างคือใช้วันนี้)
     * @return string (เช่น 'QT/2605-0001')
     */
    public static function generate(string $docKey, int $companyId, ?string $customDate = null): string
    {
        // 1. ดึงการตั้งค่าของบริษัท
        $company = Company::find($companyId);
        if (!$company) return 'ERR-NOCOMP';

        $settings = $company->document_settings;

        // ถ้าบริษัทยังไม่เคยตั้งค่า ให้ใช้ค่า Default ขัดตาทัพไปก่อน
        if (!$settings) {
            $settings = [
                'format' => ['datePattern' => 'YYMM', 'prefixSeparator' => '-', 'dateSeparator' => '-', 'digits' => '4'],
                'docs' => []
            ];
        }

        $format = $settings['format'];
        // ถ้ายังไม่มีการตั้งค่า prefix ของ doc type นี้ (เช่นบริษัทใหม่ หรือ doc type ที่เพิ่งเพิ่มเข้ามาทีหลัง) ใช้ default ที่กำหนดไว้ล่วงหน้าแทนการตัด 2 ตัวอักษรแรกของ key
        $defaultPrefix = self::DEFAULT_PREFIXES[$docKey] ?? strtoupper(substr($docKey, 0, 2));
        $docConfig = $settings['docs'][$docKey] ?? ['prefix' => $defaultPrefix];
        // 🩹 trim ไว้ก่อน กันเคสเว้นวรรคล้วนถูกนับว่า "มีตัวนำหน้า" ทั้งที่ควรถือว่าว่างเปล่า
        $docPrefix = trim($docConfig['prefix'] ?? '');
        $prefix = $docPrefix;

        // 🏷️ ตัวย่อนำหน้าบริษัทเสริม (เช่น "ST") — ตั้งค่าเดียวใช้กับทุกประเภทเอกสารเหมือนกันหมด ต่อด้วย prefixSeparator เดียวกับที่คั่น prefix กับวันที่
        // 🩹 ถ้าตัวนำหน้าเอกสารเอง (prefix) ว่างเปล่า ไม่ต้องแปะ separator ต่อท้ายตัวย่อบริษัท กันเลขที่เอกสารมีขีดค้าง (เช่น "ST--2609-0001")
        if (($format['companyPrefixEnabled'] ?? false) && trim($format['companyPrefixText'] ?? '') !== '') {
            $pSepForCompanyPrefix = $format['prefixSeparator'] === 'none' ? '' : $format['prefixSeparator'];
            $prefix = $docPrefix !== ''
                ? trim($format['companyPrefixText']) . $pSepForCompanyPrefix . $docPrefix
                : trim($format['companyPrefixText']);
        }

        // 2. จัดการเรื่องวันที่และ Period
        $date = $customDate ? Carbon::parse($customDate) : Carbon::now();
        $datePart = '';
        $period = 'all'; // ถ้าไม่ได้ใช้วันที่ ให้ Period เป็นคำว่า all

        switch ($format['datePattern']) {
            case 'YYYYMMDD':
                $datePart = $date->format('Ymd'); // 20260502
                $period = $datePart;
                break;
            case 'YYYYMM':
                $datePart = $date->format('Ym'); // 202605
                $period = $datePart;
                break;
            case 'YYMM':
                $datePart = $date->format('ym'); // 2605
                $period = $datePart;
                break;
            case 'YYYY':
                $datePart = $date->format('Y'); // 2026
                $period = $datePart;
                break;
        }

        // 3. ป้องกันปัญหาแย่งกันกดสร้างเอกสารพร้อมกันด้วย DB Transaction + row lock
        return DB::transaction(function () use ($companyId, $docKey, $period, $prefix, $format, $datePart) {

            // 🔒 ล็อกแถวก่อนอ่าน กันสองคำขอพร้อมกันอ่าน last_number เดิมซ้ำแล้วปั๊มเลขซ้ำกัน (lost update)
            $sequence = DocumentSequence::where('company_id', $companyId)
                ->where('doc_type', $docKey)
                ->where('period', $period)
                ->lockForUpdate()
                ->first();

            if (!$sequence) {
                try {
                    $sequence = DocumentSequence::create([
                        'company_id' => $companyId,
                        'doc_type' => $docKey,
                        'period' => $period,
                        'last_number' => 0,
                    ]);
                } catch (\Illuminate\Database\QueryException $e) {
                    // มีอีกคำขอสร้างแถวแรกของ period นี้ไปพร้อมกันแล้ว (ชน unique constraint) ดึงแถวจริงมาล็อกต่อ
                    $sequence = DocumentSequence::where('company_id', $companyId)
                        ->where('doc_type', $docKey)
                        ->where('period', $period)
                        ->lockForUpdate()
                        ->firstOrFail();
                }
            }

            // บวกเลขขึ้น 1
            $sequence->last_number += 1;
            $sequence->save();

            // 4. ประกอบร่าง (Formatting)
            $pSep = $format['prefixSeparator'] === 'none' ? '' : $format['prefixSeparator'];
            $dSep = $format['dateSeparator'] === 'none' ? '' : $format['dateSeparator'];

            // เติมเลขศูนย์ข้างหน้าตามจำนวนหลักที่ตั้งไว้ (เช่น 0001)
            $runNum = str_pad($sequence->last_number, (int)$format['digits'], '0', STR_PAD_LEFT);

            // ผลลัพธ์สุดท้าย
            // 🩹 ถ้า prefix สุดท้าย (รวมตัวย่อบริษัทแล้ว) ว่างเปล่า ไม่ต้องมี separator นำหน้าเลขที่เอกสารเลย
            if ($datePart !== '') {
                return $prefix !== '' ? "{$prefix}{$pSep}{$datePart}{$dSep}{$runNum}" : "{$datePart}{$dSep}{$runNum}";
            }
            return $prefix !== '' ? "{$prefix}{$dSep}{$runNum}" : "{$runNum}";
        });
    }
}
