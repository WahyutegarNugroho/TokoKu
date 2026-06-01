'use client';

import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { db, type LocalProduct, type LocalProductVariant, type LocalVariantOption } from '@/lib/dexie';
import { type SelectedVariantOption } from '@/types';
import { useToastStore } from '@/store/toastStore';

interface VariantSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: LocalProduct | null;
  onConfirm: (selectedOptions: SelectedVariantOption[]) => void;
}

export default function VariantSelectorModal({ isOpen, onClose, product, onConfirm }: VariantSelectorModalProps) {
  const [variants, setVariants] = useState<LocalProductVariant[]>([]);
  const [options, setOptions] = useState<LocalVariantOption[]>([]);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, LocalVariantOption>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isOpen || !product) return;

    const loadVariantsAndOptions = async () => {
      setIsLoading(true);
      try {
        const prodVars = await db.productVariants.where('product_id').equals(product.id).toArray();
        setVariants(prodVars);

        if (prodVars.length > 0) {
          const varIds = prodVars.map((v) => v.id);
          const varOpts = await db.variantOptions.where('variant_id').anyOf(varIds).toArray();
          setOptions(varOpts);

          // Auto-select first option for each variant group
          const initialSelection: Record<string, LocalVariantOption> = {};
          prodVars.forEach((v) => {
            const groupOpts = varOpts.filter((o) => o.variant_id === v.id);
            if (groupOpts.length > 0) {
              initialSelection[v.id] = groupOpts[0];
            }
          });
          setSelectedOptions(initialSelection);
        }
      } catch (err) {
        console.error('Failed to load variants:', err);
        useToastStore.getState().addToast('Gagal memuat varian produk.', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadVariantsAndOptions();
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const handleSelectOption = (variantId: string, option: LocalVariantOption) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [variantId]: option,
    }));
  };

  const handleConfirm = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const formattedOptions: SelectedVariantOption[] = variants.map((v) => {
        const selected = selectedOptions[v.id];
        return {
          variant_name: v.name,
          option_name: selected?.name || '',
          price_modifier: selected?.price_modifier || 0,
        };
      });
      onConfirm(formattedOptions);
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  // Compute live price
  const basePrice = product.price;
  const modifierSum = Object.values(selectedOptions).reduce((sum, opt) => sum + opt.price_modifier, 0);
  const totalPrice = basePrice + modifierSum;

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md border border-hairline overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-hairline bg-surface-muted flex items-center justify-between">
          <div>
            <h3 className="font-sans font-bold text-[16px] text-ink">Pilih Varian</h3>
            <p className="text-xs text-slate mt-0.5">{product.name}</p>
          </div>
          <button
            aria-label="Tutup modal pilih varian"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-stone transition-colors cursor-pointer text-slate"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="py-8 text-center text-slate font-sans text-sm">Memuat varian...</div>
          ) : variants.length === 0 ? (
            <div className="py-8 text-center text-slate font-sans text-sm">Tidak ada varian untuk produk ini.</div>
          ) : (
            variants.map((v) => {
              const groupOpts = options.filter((o) => o.variant_id === v.id);
              const selectedOpt = selectedOptions[v.id];

              return (
                <div key={v.id} className="space-y-2">
                  <label className="font-sans font-bold text-xs text-charcoal uppercase tracking-wider">
                    {v.name}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {groupOpts.map((opt) => {
                      const isSelected = selectedOpt?.id === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelectOption(v.id, opt)}
                          className={`px-3 py-2 rounded-xl text-sm font-sans flex items-center gap-1.5 transition-all cursor-pointer select-none border ${
                            isSelected
                              ? 'bg-primary-soft text-primary border-primary/30 font-semibold'
                              : 'bg-canvas text-charcoal border-hairline hover:bg-stone'
                          }`}
                        >
                          {isSelected && <Check className="w-4 h-4" />}
                          <span>{opt.name}</span>
                          {opt.price_modifier !== 0 && (
                            <span className="font-mono text-xs opacity-75">
                              ({opt.price_modifier > 0 ? '+' : ''}Rp {opt.price_modifier.toLocaleString('id-ID')})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-hairline bg-surface-muted flex items-center justify-between gap-4">
          <div>
            <span className="text-xs text-muted block font-sans">Total Harga Item</span>
            <span className="font-mono font-bold text-[18px] text-primary">
              Rp {totalPrice.toLocaleString('id-ID')}
            </span>
          </div>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || variants.some((v) => !selectedOptions[v.id])}
            className="h-[48px] px-6 rounded-xl bg-primary text-on-primary font-sans font-bold hover:bg-primary-pressed transition-colors cursor-pointer select-none disabled:opacity-50"
          >
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
}
