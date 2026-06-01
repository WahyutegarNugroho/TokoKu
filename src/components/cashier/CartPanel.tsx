"use client";

import React from "react";
import { ShoppingCart, Minus, Plus, Trash2, Percent, User } from "lucide-react";
import RupiahInput from "@/components/RupiahInput";
import { type CartItem } from "@/types";

interface CartPanelProps {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  discountAmount: number;
  discountType: 'FIXED' | 'PERCENT';
  tax: number;
  total: number;
  taxEnabled: boolean;
  taxRate: number;
  selectedCustomer: { id: string; name: string } | null;
  discountInput: string;
  onUpdateQuantity: (cartItemId: string, amount: number) => void;
  onRemoveFromCart: (cartItemId: string) => void;
  onClearCart: () => void;
  onDiscountChange: (value: string) => void;
  onDiscountTypeChange: (type: 'FIXED' | 'PERCENT') => void;
  onItemDiscountChange: (cartItemId: string, discount: number) => void;
  onCustomerPickerOpen: () => void;
  onCustomerRemove: () => void;
  onPaymentOpen: () => void;
}

export default function CartPanel({
  cart, subtotal, discountAmount, discountType, tax, total, taxEnabled, taxRate,
  selectedCustomer, discountInput,
  onUpdateQuantity, onRemoveFromCart, onClearCart,
  onDiscountChange, onDiscountTypeChange, onItemDiscountChange, onCustomerPickerOpen, onCustomerRemove,
  onPaymentOpen,
}: CartPanelProps) {
  return (
    <div className="md:col-span-4 bg-surface border border-hairline rounded-xl flex flex-col overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between">
        <div className="flex items-center text-ink">
          <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
          <span className="font-sans font-bold text-[16px]">Keranjang Belanja</span>
        </div>
        <span className="bg-primary-soft text-primary font-mono text-[12px] font-bold px-2 py-0.5 rounded">
          {cart.reduce((sum, item) => sum + item.quantity, 0)} item
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate font-sans py-12">
            <ShoppingCart className="w-12 h-12 text-stone mb-3" />
            <p className="font-semibold text-charcoal">Keranjang Kosong</p>
            <p className="text-xs text-muted text-center mt-1">Klik item produk di samping kiri untuk belanja.</p>
          </div>
        ) : (
          cart.map((item) => {
            const variantModifiers = item.selectedVariants?.reduce((sum, v) => sum + v.price_modifier, 0) || 0;
            const basePrice = item.product.price + variantModifiers;
            return (
              <div key={item.cartItemId} className="flex flex-col py-2 border-b border-hairline-soft">
                <div className="flex justify-between items-center">
                  <div className="min-w-0 flex-1 pr-3">
                    <h5 className="font-sans font-medium text-[14px] text-ink truncate">{item.product.name}</h5>
                    {item.selectedVariants && item.selectedVariants.length > 0 && (
                      <div className="text-[11px] text-slate font-sans space-y-0.5 mt-0.5">
                        {item.selectedVariants.map((v, idx) => (
                          <div key={idx} className="flex items-center text-muted">
                            <span>• {v.variant_name}: {v.option_name}</span>
                            {v.price_modifier !== 0 && (
                              <span className="font-mono ml-1 text-slate">
                                ({v.price_modifier > 0 ? '+' : ''}Rp {v.price_modifier.toLocaleString("id-ID")})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="font-mono text-[14px] text-slate mt-0.5">
                      Rp {basePrice.toLocaleString("id-ID")}
                      {item.discount && item.discount > 0 ? (
                        <span className="text-danger ml-2 text-xs font-semibold">(-Rp {item.discount.toLocaleString("id-ID")})</span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button aria-label="Kurangi jumlah item" onClick={() => onUpdateQuantity(item.cartItemId, -1)} className="w-10 h-10 rounded-lg bg-canvas text-charcoal hover:bg-stone flex items-center justify-center cursor-pointer transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-mono font-bold text-[14px] w-6 text-center text-ink">{item.quantity}</span>
                    <button aria-label="Tambah jumlah item" onClick={() => onUpdateQuantity(item.cartItemId, 1)} className="w-10 h-10 rounded-lg bg-canvas text-charcoal hover:bg-stone flex items-center justify-center cursor-pointer transition-colors">
                      <Plus className="w-4 h-4" />
                    </button>
                    <button aria-label="Hapus item dari keranjang" onClick={() => onRemoveFromCart(item.cartItemId)} className="w-10 h-10 rounded-lg bg-danger-soft text-danger hover:bg-danger hover:text-on-primary flex items-center justify-center cursor-pointer transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                  <span className="text-muted font-sans">Diskon item:</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Rp"
                    value={item.discount || ''}
                    onChange={(e) => onItemDiscountChange(item.cartItemId, parseFloat(e.target.value) || 0)}
                    className="w-24 bg-canvas border border-hairline rounded px-2 py-1 text-right font-mono text-charcoal focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-hairline space-y-2">
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-slate" />
          <div className="flex-1 flex gap-2">
            {discountType === 'FIXED' ? (
              <RupiahInput value={discountInput} placeholder="Diskon (Rp)" onChange={onDiscountChange} className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[48px] text-sm font-mono focus:outline-none focus:border-primary" />
            ) : (
              <input type="number" min="0" max="100" placeholder="Diskon (%)" value={discountInput} onChange={(e) => onDiscountChange(e.target.value)} className="flex-1 bg-canvas border border-hairline rounded-lg px-3 h-[48px] text-sm font-mono focus:outline-none focus:border-primary" />
            )}
            <button
              type="button"
              onClick={() => onDiscountTypeChange(discountType === 'FIXED' ? 'PERCENT' : 'FIXED')}
              className="bg-secondary text-on-dark font-sans font-bold px-3 text-xs rounded-lg hover:bg-secondary-pressed cursor-pointer"
            >
              {discountType === 'FIXED' ? 'Rp' : '%'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate" />
          <button onClick={onCustomerPickerOpen} className="flex-1 text-left text-sm text-charcoal border border-hairline rounded-lg px-3 h-[48px] bg-canvas hover:bg-surface-muted cursor-pointer truncate">
            {selectedCustomer ? selectedCustomer.name : "+ Cari Pelanggan"}
          </button>
          {selectedCustomer && <button onClick={onCustomerRemove} className="text-xs text-danger font-semibold cursor-pointer">Hapus</button>}
        </div>
      </div>

      <div className="p-4 border-t border-hairline bg-surface-muted space-y-2">
        <div className="flex justify-between text-sm font-sans font-medium text-slate">
          <span>Subtotal</span>
          <span className="font-mono text-ink">Rp {subtotal.toLocaleString("id-ID")}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm font-sans font-medium text-danger">
            <span>Diskon</span>
            <span className="font-mono">-Rp {discountAmount.toLocaleString("id-ID")}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-sans font-medium text-slate">
          <span>{taxEnabled ? "Pajak (" + taxRate + "% PPN)" : "Pajak (Non-PPN)"}</span>
          <span className="font-mono text-ink">Rp {tax.toLocaleString("id-ID")}</span>
        </div>
        <div className="flex justify-between border-t border-hairline pt-2 text-base font-sans font-bold text-ink">
          <span>Total Tagihan</span>
          <span className="font-sans font-bold text-[36px] text-primary tracking-tight">Rp {total.toLocaleString("id-ID")}</span>
        </div>
      </div>

      <div className="p-4 bg-surface border-t border-hairline grid grid-cols-3 gap-2">
        <button
          onClick={onClearCart}
          disabled={cart.length === 0}
          className="h-[48px] rounded-lg bg-danger-soft text-danger font-semibold text-[15px] hover:bg-danger hover:text-on-primary transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Void
        </button>
        <button
          onClick={onPaymentOpen}
          disabled={cart.length === 0}
          className="col-span-2 h-[48px] rounded-lg bg-primary text-on-primary font-semibold text-[15px] hover:bg-primary-pressed transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow"
        >
          Bayar Sekarang
        </button>
      </div>
    </div>
  );
}
