import type { ResolvedAstroPaperConfig } from "@/types/config";
import { getAssetPath } from "./withBase";

const publicFiles = import.meta.glob("/public/*", { eager: false });

function existsInPublic(filename: string): boolean {
  return `/public/${filename}` in publicFiles;
}

/**
 * og.png.ts와 posts/[...slug]/index.png.ts가 그리는 OG 이미지의 크기.
 * 두 생성기와 og:image:width/height 메타 태그가 이 값 하나를 같이 쓴다.
 */
export const GENERATED_OG_IMAGE_SIZE = { width: 1200, height: 630 };

/**
 * resolveDefaultOgImagePath가 고른 기본 이미지의 크기. 빌드 때 그리는 /og.png일 때만 알고,
 * public/의 파일이면 크기를 읽지 않으므로 undefined다. 메타 태그가 없으면 공유 카드가 이미지를 받아 잰다.
 */
export function resolveDefaultOgImageSize(
  config: ResolvedAstroPaperConfig
): { width: number; height: number } | undefined {
  return config.features.dynamicOgImage && !existsInPublic(config.site.ogImage)
    ? GENERATED_OG_IMAGE_SIZE
    : undefined;
}

/**
 * Resolves the absolute OG image path used for pages/posts.
 *
 * Security note: `site.ogImage` must be a single filename under `public/` to avoid
 * path traversal or referencing arbitrary files.
 *
 * Behavior:
 * - When `features.dynamicOgImage` is enabled, prefers `public/{site.ogImage}` when present,
 *   otherwise falls back to the generated `/og.png`.
 * - When disabled, requires `public/{site.ogImage}` to exist.
 */
export function resolveDefaultOgImagePath(
  config: ResolvedAstroPaperConfig
): string {
  const filename = config.site.ogImage;
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new Error(
      `site.ogImage must be a single filename in public/ (e.g. "default-og.jpg"), got "${filename}"`
    );
  }

  if (config.features.dynamicOgImage) {
    return existsInPublic(filename)
      ? getAssetPath(filename)
      : getAssetPath("og.png");
  }

  if (!existsInPublic(filename)) {
    throw new Error(
      `AstroPaper: missing public/${filename}. Add that file, or set site.ogImage to an existing file under public/, or enable features.dynamicOgImage to fall back to /og.png.`
    );
  }

  return getAssetPath(filename);
}
