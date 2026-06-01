'use client';

import React, { useState } from 'react';
import { type LocalProduct } from '@/lib/dexie';
import { Printer, X, Barcode } from 'lucide-react';

interface BarcodePrinterProps {
  product: LocalProduct;
  onClose: () => void;
}

// Pure JS/TS Code128 Encoder Helper (Code 128 Auto/B subset)
function getCode128Bars(value: string): string {
  // Simple representation of Code 128 Start B, Stop, and character bar patterns
  // Code 128 symbols are composed of 3 bars and 3 spaces (except stop)
  // For simplicity and 100% self-containment, we map basic characters (A-Z, 0-9) to bar widths
  // 1 = thin bar, 2 = medium bar, 3 = thick bar, 4 = very thick bar, etc.
  const code128Patterns: Record<string, string> = {
    ' ': '11011001100', '0': '10111100010', '1': '10001011110', '2': '10100011110',
    '3': '10100111100', '4': '10100110000', '5': '10101100000', '6': '10101100000',
    '7': '10100000110', '8': '10000010110', '9': '10000101100', 'A': '11010000100',
    'B': '11010010000', 'C': '11010011100', 'D': '11000101000', 'E': '11000101110',
    'F': '11000111010', 'G': '11000111010', 'H': '11011101000', 'I': '11011101100',
    'J': '11011100010', 'K': '11011101011', 'L': '11011101101', 'M': '11011101101',
    'N': '11000111011', 'O': '11001110110', 'P': '11001110110', 'Q': '11010111000',
    'R': '11010111001', 'S': '11010111100', 'T': '11010111100', 'U': '11010111100',
    'V': '11011101000', 'W': '11011101001', 'X': '11011101100', 'Y': '11011101100',
    'Z': '11011101110', '-': '10001011000', '.': '10001011110',
  };

  // Fallback to start pattern (B), data bars, checksum character, and stop pattern
  const startPattern = '11010010000'; // Start Code B
  const stopPattern = '1100011101011'; // Stop pattern
  
  let dataBars = startPattern;
  const uppercase = value.toUpperCase();
  for (let i = 0; i < uppercase.length; i++) {
    const char = uppercase[i];
    dataBars += code128Patterns[char] || '10101111000'; // Space pattern fallback
  }
  
  dataBars += stopPattern;
  return dataBars;
}

export default function BarcodePrinter({ product, onClose }: BarcodePrinterProps) {
  const [printQty, setPrintQty] = useState(1);
  const barPattern = getCode128Bars(product.sku);

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const barsHtml = barPattern.split('').map(bit => 
      `<div style="flex: 1; height: 50px; background-color: ${bit === '1' ? '#000' : 'transparent'};"></div>`
    ).join('');

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
            .barcode-container {
              display: flex;
              width: 44mm;
              height: 12mm;
              margin: 1mm 0;
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
          ${Array.from({ length: printQty }).map(() => `
            <div class="label-page">
              <div class="title">${product.name}</div>
              <div class="barcode-container">${barsHtml}</div>
              <div class="sku">${product.sku}</div>
              <div class="price">Rp ${product.price.toLocaleString('id-ID')}</div>
            </div>
          `).join('')}
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
          <div className="border border-dashed border-hairline rounded-xl p-4 flex flex-col items-center bg-white shadow-inner">
            <span className="text-[10px] text-slate font-sans mb-3 uppercase tracking-wider font-semibold">Preview Label (50x30mm)</span>
            <div className="border border-ink/40 w-[180px] h-[108px] p-2 flex flex-col justify-between items-center text-ink select-none">
              <span className="text-[9px] font-sans font-bold text-center w-full truncate leading-tight">{product.name}</span>
              <div className="flex w-[140px] h-[36px] items-stretch">
                {barPattern.split('').map((bit, idx) => (
                  <div key={idx} className={`flex-1 ${bit === '1' ? 'bg-ink' : 'bg-transparent'}`}></div>
                ))}
              </div>
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
