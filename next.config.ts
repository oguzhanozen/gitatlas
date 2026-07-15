import type { NextConfig } from "next";

function normalizedBasePath(value: string | undefined): string {
  const candidate = value?.trim() ?? "";
  if (!candidate || candidate === "/") return "";

  const normalized = `/${candidate.replace(/^\/+|\/+$/g, "")}`;
  if (/[:?#\\]/.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error("NEXT_PUBLIC_BASE_PATH yalnızca güvenli bir URL path'i olmalıdır (ör. /gitatlas).")
  }
  return normalized;
}

const basePath = normalizedBasePath(process.env.NEXT_PUBLIC_BASE_PATH);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
};
export default nextConfig;
