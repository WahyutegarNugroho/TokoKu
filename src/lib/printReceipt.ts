import { escapeHtml } from './utils';
import { useToastStore } from '@/store/toastStore';

export function printReceipt(
  storeName: string, storeAddress: string | null, storePhone: string | null,
  date: string, invoiceId: string, cashierName: string,
  items: { name: string; quantity: number; total: number }[],
  tax: number, total: number, cashReceived: number, change: number, paymentMethod: string,
  taxRate: number = 11,
) {
  const w = window.open("", "_blank");
  if (!w) { useToastStore.getState().addToast('Izinkan pop-up untuk mencetak nota.', 'warning'); return; }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Struk - ${escapeHtml(storeName)}</title>
<style>
  @page { margin: 0; } body { margin: 0; padding: 20px; font-family: "Courier New", monospace; font-size: 13px; color: #000; width: 80mm; }
  table { width: 100%; border-collapse: collapse; } td { padding: 2px 0; }
  .hdr { text-align: center; margin-bottom: 10px; } .hdr h2 { margin: 0; font-size: 16px; }
  .hdr p { margin: 2px 0; font-size: 11px; color: #555; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .item td:last-child { text-align: right; } .total td { font-weight: bold; padding-top: 4px; }
  .footer { text-align: center; margin-top: 10px; font-size: 11px; }
</style></head><body>
<div class="hdr"><h2>${escapeHtml(storeName)}</h2>${storeAddress ? `<p>${escapeHtml(storeAddress)}</p>` : ""}${storePhone ? `<p>Telp: ${escapeHtml(storePhone)}</p>` : ""}
<p>${escapeHtml(date)}</p><p>Invoice: #${escapeHtml(invoiceId)}</p><p>Kasir: ${escapeHtml(cashierName)}</p></div>
<div class="divider"></div><table>${items.map(i => `<tr class="item"><td>${escapeHtml(i.name.slice(0, 25))}</td><td>x${i.quantity}</td><td>Rp ${i.total.toLocaleString("id-ID")}</td></tr>`).join("")}</table>
<div class="divider"></div><table>
<tr class="total"><td>PPN ${taxRate}%</td><td></td><td>Rp ${tax.toLocaleString("id-ID")}</td></tr>
<tr class="total"><td>TOTAL</td><td></td><td>Rp ${total.toLocaleString("id-ID")}</td></tr>
<tr><td>Bayar</td><td></td><td>Rp ${cashReceived.toLocaleString("id-ID")}</td></tr>
${change > 0 ? `<tr><td>Kembali</td><td></td><td>Rp ${change.toLocaleString("id-ID")}</td></tr>` : ""}
${paymentMethod.includes(":") ? `<tr><td colspan="3" style="font-size:10px;color:#888;text-align:center;padding-top:4px;">${escapeHtml(paymentMethod)}</td></tr>` : ""}
</table><div class="divider"></div><div class="footer">Terima kasih telah berbelanja!</div></div></body></html>`;
  w.document.write(html); w.document.close(); w.focus();
  setTimeout(() => { w.print(); }, 300);
}
