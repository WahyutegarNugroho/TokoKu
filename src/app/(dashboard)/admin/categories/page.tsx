'use client';

import React from 'react';
import CategoryManager from '@/components/CategoryManager';

export default function CategoriesPage() {
  return (
    <div className="bg-surface rounded-xl border border-hairline overflow-hidden p-6">
      <CategoryManager />
    </div>
  );
}
