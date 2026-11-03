"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import { QrCode, Download } from "@/components/icons";

/** Scanning this opens ShePlates directly at this vendor's shop (see the
 * "?vendor=" query-param handling in sheplates-entry.tsx / sheplates-v3.tsx —
 * there's no path router in this app, so a query param is the deep link). A
 * signed-out scan is prompted to sign in first; an already signed-in
 * customer lands straight in Marketplace filtered to this vendor, ready to
 * Add to Cart or Schedule. */
export function VendorQrCode({ vendorId, vendorName }: { vendorId: string; vendorName: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [shopUrl, setShopUrl] = useState("");

  useEffect(() => {
    const url = `${window.location.origin}${window.location.pathname}?vendor=${vendorId}`;
    queueMicrotask(() => setShopUrl(url));
    QRCode.toDataURL(url, { width: 320, margin: 1, color: { dark: "#312629", light: "#ffffff" } })
      .then(setDataUrl)
      .catch(() => setDataUrl(""));
  }, [vendorId]);

  return (
    <div className="surface-card rounded-[26px] p-5">
      <div className="flex items-center gap-2 text-[#292124]"><QrCode className="size-5 text-[#653046]" /><h3 className="font-black">Your shop QR code</h3></div>
      <p className="mt-1.5 text-sm leading-5 text-stone-500">Print this at your counter or packaging. Scanning it opens ShePlates straight at your shop, and a signed-in customer can Add to Cart or Schedule right away.</p>
      <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="grid size-40 shrink-0 place-items-center overflow-hidden rounded-2xl border border-stone-200/70 bg-white p-2">
          {dataUrl ? <Image src={dataUrl} alt={`QR code for ${vendorName}`} width={144} height={144} unoptimized className="h-full w-full object-contain" /> : <span className="text-xs text-stone-400">Generating…</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="truncate rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-500">{shopUrl || "…"}</div>
          {dataUrl && <a href={dataUrl} download={`${vendorName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`} className="inline-flex items-center gap-2 rounded-xl bg-[#753b50] px-4 py-2.5 text-sm font-black text-white hover:bg-[#292124]"><Download className="size-4" />Download QR</a>}
        </div>
      </div>
    </div>
  );
}
