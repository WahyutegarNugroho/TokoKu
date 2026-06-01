'use client';

import React from 'react';
import { CheckCircle, FileText } from 'lucide-react';
import { formatShortId } from '@/lib/utils';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface CartItem {
  product: { id: string; name: string; price: number };
  quantity: number;
}

interface ReceiptModalProps {
  lastTransaction: {
    id: string;
    total: number;
    tax: number;
    paymentMethod: string;
    change: number;
    items: CartItem[];
    date: string;
    cashierName: string;
    storeName: string;
    storeAddress: string;
    storePhone: string;
  } | null;
  onClose: () => void;
  onPrint: () => void;
}

export default function ReceiptModal({ lastTransaction, onClose, onPrint }: ReceiptModalProps) {
  const focusRef = useFocusTrap(!!lastTransaction);
  if (!lastTransaction) return null;

  return (
    <div ref={focusRef} className="fixed inset-0 bg-secondary/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-hairline max-w-md w-full overflow-hidden shadow-floating p-6 space-y-6">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-success mx-auto mb-3" />
          <h3 className="font-sans font-bold text-[22px] text-ink">Pembayaran Berhasil!</h3>
          <p className="text-muted font-sans text-sm mt-1">Transaksi Anda telah dicatat.</p>
        </div>

        <div className="bg-canvas border border-hairline rounded-lg p-4 font-mono text-[13px] leading-relaxed text-charcoal space-y-3 shadow-inner">
          <div className="text-center border-b border-hairline border-dashed pb-2">
            <p className="font-bold text-[15px]">{lastTransaction.storeName}</p>
            {lastTransaction.storeAddress && <p className="text-[11px] text-slate">{lastTransaction.storeAddress}</p>}
            {lastTransaction.storePhone && <p className="text-[11px] text-slate">Telp: {lastTransaction.storePhone}</p>}
            <p className="text-[11px] text-slate mt-1">{lastTransaction.date}</p>
            <p className="text-[13px] text-slate">Invoice: #{formatShortId(lastTransaction.id)}</p>
            <p className="text-[11px] text-primary font-semibold">Kasir: {lastTransaction.cashierName}</p>
          </div>

          <div className="space-y-1.5 border-b border-hairline border-dashed pb-3">
            {lastTransaction.items.map((item) => (
              <div key={item.product.id} className="flex justify-between">
                <span>{item.product.name.slice(0, 20)} x{item.quantity}</span>
                <span>Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}</span>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-right">
            <div className="flex justify-between"><span>Pajak PPN</span><span>Rp {lastTransaction.tax.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between font-bold text-ink"><span>TOTAL</span><span>Rp {lastTransaction.total.toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between text-slate"><span>Bayar</span><span>Rp {(lastTransaction.total + lastTransaction.change).toLocaleString('id-ID')}</span></div>
            {lastTransaction.change > 0 && (
              <div className="flex justify-between text-success font-semibold"><span>Kembali</span><span>Rp {lastTransaction.change.toLocaleString('id-ID')}</span></div>
            )}
          </div>
          {lastTransaction.paymentMethod.includes(':') && (
            <div className="text-[11px] text-slate text-center border-t border-hairline border-dashed pt-2">
              {lastTransaction.paymentMethod}
            </div>
          )}

          <div className="text-center border-t border-hairline border-dashed pt-2 text-[11px] text-slate">
            Terima kasih telah berbelanja!
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button type="button" onClick={onPrint} className="h-[48px] rounded-lg border border-hairline text-charcoal font-semibold text-[15px] hover:bg-canvas transition-colors flex items-center justify-center cursor-pointer">
            <FileText className="w-4 h-4 mr-2" />
            Cetak Struk
          </button>
          <button type="button" onClick={onClose} className="h-[48px] rounded-lg bg-primary text-on-primary font-semibold text-[15px] hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer shadow">
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}
