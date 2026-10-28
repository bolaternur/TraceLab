import Image from "next/image";

/** Supplied wordmark on a quiet light surface so its graphite lettering stays legible. */
export function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={`iznera-wordmark ${className}`}><Image src="/brand/iznera-logo.png" width={320} height={90} alt="Iznera" unoptimized /></span>;
}
