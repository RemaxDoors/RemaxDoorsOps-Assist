import Image from "next/image";
import logo from "@/../public/brand/remax-doors-logo.png";

/** Official remax DOORS brandmark (black wordmark, red chevron). */
export function Logo({ width = 150 }: { width?: number }) {
  return (
    <Image
      src={logo}
      alt="remax DOORS"
      width={width}
      height={Math.round((width * 346) / 980)}
      priority
      className="h-auto"
    />
  );
}
