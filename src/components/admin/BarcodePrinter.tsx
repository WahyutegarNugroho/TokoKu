'use client';

import React, { useState, useRef, useEffect } from 'react';
import { type LocalProduct } from '@/lib/dexie';
import { Printer, X, Barcode } from 'lucide-react';
import JsBarcode from 'jsbarcode';

interface BarcodePrinterProps {
  product: LocalProduct;
  onClose: () => void;
}

export default function BarcodePrinter({ product, onClose }: BarcodePrinterProps) {
  const [printQty, setPrintQty] = useState(1);
  const previewBarcodeRef = useRef<SVGSVGElement>(null);

  // Render barcode preview using jsbarcode
  useEffect(() => {
    if (previewBarcodeRef.current) {
      try {
        JsBarcode(previewBarcodeRef.current, product.sku, {
          format: 'CODE128',
          width: 2,
          height: 50,
          displayValue: false,
        });
      } catch (err) {
        console.warn('Failed to render barcode:', err);
      }
    }
  }, [product.sku]);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Generate SVG barcode for each label
    const labels = Array.from({ length: printQty })
      .map(() => {
        // Create a temporary SVG to convert to data URI
        const svg = document.createElement('svg');
        try {
          JsBarcode(svg, product.sku, {
            format: 'CODE128',
            width: 2,
            height: 50,
            displayValue: false,
          });
          const svgString = svg.outerHTML;
          const encodedSvg = encodeURIComponent(svgString);
          const dataUri = `data:image/svg+xml,${encodedSvg}`;
          return `
            <div class="label-page">
              <div class="title">${product.name}</div>
              <img class="barcode-image" src="${dataUri}" alt="Barcode" />
              <div class="sku">${product.sku}</div>
              <div class="price">Rp ${product.price.toLocaleString('id-ID')}</div>
            </div>
          `;
        } catch (err) {
          console.warn('Failed to generate barcode:', err);
          return `
            <div class="label-page">
              <div class="title">${product.name}</div>
              <div class="barcode-error">Error generating barcode</div>
              <div class="sku">${product.sku}</div>
              <div class="price">Rp ${product.price.toLocaleString('id-ID')}</div>
            </div>
          `;
        }
      })
      .join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak Label - ${product.name}</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: 'Inter', sans-serif;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .label-page {
              width: 50mm;
              height: 30mm;
              padding: 2mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              page-break-after: always;
              overflow: hidden;
            }
            .title {
              font-size: 8px;
              font-weight: bold;
              text-align: center;
              margin-bottom: 1px;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .barcode-image {
              max-width: 44mm;
              max-height: 12mm;
              margin: 1mm 0;
            }
            .barcode-error {
              font-size: 7px;
              color: red;
              margin: 1mm 0;
              width: 44mm;
              height: 12mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .sku {
              font-family: monospace;
              font-size: 7px;
              letter-spacing: 1px;
              margin-top: 1px;
            }
            .price {
              font-size: 9px;
              font-weight: bold;
              margin-top: 1px;
            }
          </style>
        </head>
        <body>
          ${labels}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl w-full max-w-sm border border-hairline overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-primary" />
            <h3 className="font-sans font-bold text-[16px] text-ink">Cetak Label Barcode</h3>
          </div>
          <button
            aria-label="Tutup modal cetak barcode"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone transition-colors cursor-pointer text-slate"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="bg-canvas p-3.5 rounded-xl border border-hairline-soft">
            <span className="text-[11px] font-sans font-semibold text-slate block uppercase tracking-wider">Produk</span>
            <span className="font-sans font-semibold text-sm text-ink block mt-0.5">{product.name}</span>
            <span className="font-mono text-xs text-slate block mt-0.5">{product.sku}</span>
          </div>

          <div className="space-y-1.5">
            <label className="font-sans font-semibold text-xs text-charcoal block">
              Jumlah Label
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={printQty}
              onChange={(e) => setPrintQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-canvas border border-hairline rounded-xl px-3 h-[44px] text-sm font-mono text-charcoal focus:outline-none focus:border-primary"
            />
          </div>

          {/* Render Preview */}
          <div className="border border-dashed border-hairline rounded-xl p-4 flex flex-col items-center bg-surface shadow-inner">
            <span className="text-[10px] text-slate font-sans mb-3 uppercase tracking-wider font-semibold">Preview Label (50x30mm)</span>
            <div className="border border-ink/40 w-[180px] h-[108px] p-2 flex flex-col justify-between items-center text-ink select-none">
              <span className="text-[9px] font-sans font-bold text-center w-full truncate leading-tight">{product.name}</span>
              <svg ref={previewBarcodeRef} className="max-w-[140px] max-h-[36px]"></svg>
              <span className="font-mono text-[8px] tracking-wider leading-none mt-0.5">{product.sku}</span>
              <span className="text-[10px] font-sans font-bold leading-none mt-0.5">Rp {product.price.toLocaleString('id-ID')}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hairline bg-surface-muted flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 h-[44px] rounded-xl border border-hairline text-charcoal font-sans font-semibold text-sm hover:bg-canvas cursor-pointer"
          >
            Batal
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 h-[44px] rounded-xl bg-primary text-on-primary font-sans font-bold text-sm hover:bg-primary-pressed transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Cetak Label
          </button>
        </div>
      </div>
    </div>
  );
}
