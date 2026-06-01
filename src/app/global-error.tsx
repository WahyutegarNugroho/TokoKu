'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  console.error('Global error:', error);
  return (
    <html lang="id">
      <body className="bg-canvas text-ink">
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="bg-surface rounded-xl border border-hairline max-w-md w-full p-8 text-center space-y-4 shadow-floating">
            <div className="w-16 h-16 mx-auto rounded-full bg-danger-soft flex items-center justify-center">
              <span className="text-3xl text-danger">!</span>
            </div>
            <h2 className="font-sans font-bold text-xl text-ink">Terjadi Kesalahan</h2>
            <p className="text-sm text-charcoal font-sans">
              Maaf, terjadi kesalahan yang tidak terduga.
            </p>
            <button onClick={reset} className="bg-primary text-on-primary font-semibold text-sm h-[48px] px-6 rounded-lg hover:bg-primary-pressed transition-colors cursor-pointer">
              Coba Lagi
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
