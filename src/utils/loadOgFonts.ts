import { fontData, experimental_getFontFileURL } from "astro:assets";
import { getFontPathByWeight } from "@/utils/getFontPathByWeight";

/**
 * satori는 fonts 배열을 순서대로 훑어 글리프를 찾는다. 라틴 전용 폰트만 넘기면
 * 한글 제목이 전부 두부(□)로 렌더된다. 한글 폰트를 뒤에 붙여 폴백을 만든다.
 */
const FAMILIES = [
  { name: "Google Sans Code", cssVariable: "--font-google-sans-code" },
  { name: "Nanum Gothic Coding", cssVariable: "--font-nanum-gothic-coding" },
] as const;

const WEIGHTS = [400, 700] as const;

export async function loadOgFonts(baseUrl: URL) {
  const specs = FAMILIES.flatMap(({ name, cssVariable }) =>
    WEIGHTS.map(weight => {
      const path = getFontPathByWeight(fontData[cssVariable], weight);
      if (path === undefined) {
        throw new Error(`Cannot find the font path for ${name} ${weight}.`);
      }
      return { name, weight, path };
    })
  );

  return Promise.all(
    specs.map(async ({ name, weight, path }) => ({
      name,
      weight,
      style: "normal" as const,
      data: await fetch(experimental_getFontFileURL(path, baseUrl)).then(res =>
        res.arrayBuffer()
      ),
    }))
  );
}
