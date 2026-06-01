'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Tag } from 'lucide-react';
import { type LocalProduct } from '@/lib/dexie';

interface ProductGridProps {
  products: LocalProduct[];
  selectedCategory: string;
  searchQuery: string;
  onAddToCart: (product: LocalProduct) => void;
}

export default function ProductGrid({ products, selectedCategory, searchQuery, onAddToCart }: ProductGridProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => products.filter((prod) => {
    const matchesCategory = selectedCategory === 'ALL' || prod.category_id === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prod.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  }), [products, selectedCategory, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate font-sans bg-surface rounded-xl border border-hairline p-12">
        <Tag className="w-12 h-12 text-steel mb-3" />
        <p className="font-bold text-ink">Katalog offline kosong</p>
        <p className="text-sm mt-1">Gunakan Admin Dashboard untuk mengunggah produk awal secara online.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {filtered.map((prod) => (
        <div
          key={prod.id}
          onClick={() => onAddToCart(prod)}
          className="bg-surface rounded-lg p-4 border border-hairline hover:border-primary/50 transition-all cursor-pointer select-none flex flex-col justify-between group"
        >
          <div>
            {prod.image_url && !failedImages.has(prod.id) ? (
              <Image
                src={prod.image_url}
                alt={prod.name}
                width={200}
                height={128}
                className="w-full h-32 object-cover rounded-md mb-3"
                onError={() => setFailedImages(prev => new Set(prev).add(prod.id))}
              />
            ) : (
              <div className="w-full h-32 bg-canvas rounded-md mb-3 flex items-center justify-center text-steel font-sans font-semibold">POS</div>
            )}
            <h4 className="font-sans font-semibold text-[15px] text-ink group-hover:text-primary transition-colors line-clamp-2">{prod.name}</h4>
            <p className="font-mono text-[13px] text-muted mt-1">{prod.sku}</p>
          </div>
          <div className="mt-4 flex justify-between items-baseline">
            <span className="font-mono font-bold text-[14px] text-primary">Rp {prod.price.toLocaleString('id-ID')}</span>
            <span className={'font-mono text-[11px] font-semibold ' + (prod.stock <= 0 ? 'text-danger' : 'text-slate')}>
              {prod.stock <= 0 ? 'Habis' : 'Stok: ' + prod.stock}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
