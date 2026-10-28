import Image from "next/image";

/** User-supplied transparent wordmark, displayed directly on the page surface. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={`iznera-wordmark ${className}`}><Image src="/brand/iznera-logo.png" width={320} height={90} alt="Iznera" unoptimized /></span>;
}
