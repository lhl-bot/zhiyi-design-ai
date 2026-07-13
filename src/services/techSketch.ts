/**
 * SVG 矢量技术线稿生成器
 * 产出真正的矢量路径，设计师可直接导入 Illustrator 编辑修改
 */
import type { GeneratedLook, CustomerProfile } from "../types"

// ─── 面料纹理 SVG defs ───────────────────────────────────────────────────
const fabricDefs = `
<defs>
  <!-- 斜纹 -->
  <pattern id="twill" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <line x1="0" y1="0" x2="0" y2="12" stroke="#333" stroke-width="0.3" stroke-opacity="0.15"/>
    <line x1="0" y1="0" x2="12" y2="0" stroke="#999" stroke-width="0.2" stroke-opacity="0.1"/>
  </pattern>
  <!-- 针织 -->
  <pattern id="knit" width="8" height="8" patternUnits="userSpaceOnUse">
    <path d="M0 4 Q2 0 4 4 Q6 8 8 4" fill="none" stroke="#666" stroke-width="0.3" stroke-opacity="0.2"/>
  </pattern>
  <!-- 羽绒绗线 -->
  <pattern id="quilt" width="48" height="32" patternUnits="userSpaceOnUse">
    <rect x="0" y="0" width="48" height="16" rx="7" fill="none" stroke="#555" stroke-width="0.5" stroke-dasharray="3 2" stroke-opacity="0.4"/>
    <rect x="0" y="16" width="48" height="16" rx="7" fill="none" stroke="#555" stroke-width="0.5" stroke-dasharray="3 2" stroke-opacity="0.4"/>
  </pattern>
</defs>`

// ─── 辅助函数 ────────────────────────────────────────────────────────────
function cls(...names: (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ")
}

/** 缝线标记 */
function stitchLine(x1: number, y1: number, x2: number, y2: number) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#555" stroke-width="0.6" stroke-dasharray="4 3" />`
}

/** 省道 */
function dart(cx: number, topY: number, botY: number, h: number) {
  return `<path d="M${cx} ${topY} L${cx - h * 0.4} ${botY} L${cx + h * 0.4} ${botY} Z" fill="none" stroke="#444" stroke-width="0.7"/>`
}

/** 扣子 */
function button(cx: number, cy: number, r = 3.5) {
  return [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#333" stroke-width="0.8"/>`,
    `<circle cx="${cx}" cy="${cy}" r="0.8" fill="#333"/>`,
    `<circle cx="${cx - 1.2}" cy="${cy - 1.2}" r="0.3" fill="#666"/>`,
    `<circle cx="${cx + 1.2}" cy="${cy + 1.2}" r="0.3" fill="#666"/>`,
  ].join("")
}

/** 拉链 */
function zipper(x: number, y1: number, y2: number) {
  const h = y2 - y1
  return [
    `<rect x="${x - 1.2}" y="${y1}" width="2.4" height="${h}" fill="#ddd" stroke="#555" stroke-width="0.5"/>`,
    `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#333" stroke-width="0.4" stroke-dasharray="2 3"/>`,
  ].join("")
}

// ─── 品类工艺线稿 ────────────────────────────────────────────────────────

/** 夹克 / 外套 */
function jacketSketch(look: GeneratedLook, customer: CustomerProfile): string {
  const w = 400, h = 620
  const cx = w / 2
  const shoulders = look.keyDetails.some((d) => /垫肩|宽肩/.test(d)) ? 180 : 160
  const hem = look.keyDetails.some((d) => /A型|宽松|茧型/.test(d)) ? 180 : 150
  const hasHood = look.keyDetails.some((d) => /连帽|帽子/.test(d))
  const hasPocket = look.keyDetails.filter((d) => /口袋|贴袋|斜插/.test(d)).length > 0

  return [
    // 左半身廓形（镜像）
    `<g id="left-body">
      <path d="M${cx} ${50} C${cx - shoulders * 0.35} ${50} ${cx - shoulders * 0.5} ${110} ${cx - shoulders * 0.5} ${160}
               C${cx - shoulders * 0.5} ${280} ${cx - hem * 0.42} ${460} ${cx - hem * 0.45} ${h - 20}
               L${cx} ${h - 20}" fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>
    </g>`,
    // 右半身（镜像）
    `<g id="right-body">
      <path d="M${cx} ${50} C${cx + shoulders * 0.35} ${50} ${cx + shoulders * 0.5} ${110} ${cx + shoulders * 0.5} ${160}
               C${cx + shoulders * 0.5} ${280} ${cx + hem * 0.42} ${460} ${cx + hem * 0.45} ${h - 20}
               L${cx} ${h - 20}" fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>
    </g>`,
    // 翻领
    `<g id="collar">
      <path d="M${cx - 28} ${56} L${cx - 52} ${106} L${cx - 18} ${128} L${cx} ${116}
               L${cx + 18} ${128} L${cx + 52} ${106} L${cx + 28} ${56}" fill="#f5f5f5" stroke="#1a1a1a" stroke-width="1.5"/>
      <path d="M${cx - 18} ${128} L${cx - 32} ${146} L${cx} ${162} L${cx + 32} ${146} L${cx + 18} ${128}" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>
    </g>`,
    // 门襟
    `<line x1="${cx}" y1="${80}" x2="${cx}" y2="${h - 20}" stroke="#1a1a1a" stroke-width="1.2"/>`,
    // 扣子 x5
    ...[132, 202, 272, 342, 412].map((y) => button(cx + 12, y)),
    // 扣眼
    ...[132, 202, 272, 342, 412].map((y) =>
      `<line x1="${cx - 4}" y1="${y}" x2="${cx - 4}" y2="${y + 8}" stroke="#555" stroke-width="0.6"/>`
    ),
    // 袖窿弧线
    `<path d="M${cx - shoulders * 0.5} ${160} C${cx - shoulders * 0.58} ${180} ${cx - hem * 0.5} ${280} ${cx - hem * 0.48} ${400}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    `<path d="M${cx + shoulders * 0.5} ${160} C${cx + shoulders * 0.58} ${180} ${cx + hem * 0.5} ${280} ${cx + hem * 0.48} ${400}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 口袋
    hasPocket
      ? [
          `<rect x="${cx + 20}" y="310" width="42" height="48" rx="3" fill="#fafafa" stroke="#333" stroke-width="1.2"/>`,
          `<rect x="${cx + 20}" y="310" width="42" height="14" rx="1" fill="none" stroke="#555" stroke-width="0.8"/>`,
          stitchLine(cx + 22, 312, cx + 60, 312),
          `<rect x="${cx - 62}" y="310" width="42" height="48" rx="3" fill="#fafafa" stroke="#333" stroke-width="1.2"/>`,
          `<rect x="${cx - 62}" y="310" width="42" height="14" rx="1" fill="none" stroke="#555" stroke-width="0.8"/>`,
        ].join("")
      : "",
    // 下摆缝线
    stitchLine(cx - hem * 0.44, h - 22, cx + hem * 0.44, h - 22),
    // 肩缝
    `<line x1="${cx}" y1="50" x2="${cx - shoulders * 0.5}" y2="160" stroke="#1a1a1a" stroke-width="1.5"/>`,
    `<line x1="${cx}" y1="50" x2="${cx + shoulders * 0.5}" y2="160" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 连帽（如有）
    hasHood
      ? `<path d="M${cx - 24} ${54} C${cx - 30} ${16} ${cx - 10} ${0} ${cx} ${0} C${cx + 10} ${0} ${cx + 30} ${16} ${cx + 24} ${54}" fill="none" stroke="#1a1a1a" stroke-width="1.5" stroke-dasharray="8 3"/>`
      : "",
  ].join("")
}

/** 连衣裙 */
function dressSketch(look: GeneratedLook, customer: CustomerProfile): string {
  const w = 400, h = 700
  const cx = w / 2
  const isFitted = look.keyDetails.some((d) => /收腰|修身|合体/.test(d))
  const waist = isFitted ? 80 : 100
  const hip = isFitted ? 110 : 130
  const hem = isFitted ? 130 : 160
  const hasWaistband = look.keyDetails.some((d) => /腰带|抽绳|松紧/.test(d))

  return [
    // 廓形
    `<path d="M${cx} ${40} C${cx - 22} ${40} ${cx - 34} ${80} ${cx - 36} ${130}
             C${cx - 36} ${200} ${cx - waist * 0.35} ${280} ${cx - waist * 0.4} ${320}
             C${cx - hip * 0.35} ${390} ${cx - hip * 0.38} ${440} ${cx - hem * 0.44} ${h - 20}
             L${cx} ${h - 20}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    `<path d="M${cx} ${40} C${cx + 22} ${40} ${cx + 34} ${80} ${cx + 36} ${130}
             C${cx + 36} ${200} ${cx + waist * 0.35} ${280} ${cx + waist * 0.4} ${320}
             C${cx + hip * 0.35} ${390} ${cx + hip * 0.38} ${440} ${cx + hem * 0.44} ${h - 20}
             L${cx} ${h - 20}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    // 领口
    `<path d="M${cx - 18} ${56} C${cx - 12} ${44} ${cx - 4} ${40} ${cx} ${40} C${cx + 4} ${40} ${cx + 12} ${44} ${cx + 18} ${56}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 中心线
    `<line x1="${cx}" y1="${40}" x2="${cx}" y2="${h - 20}" stroke="#1a1a1a" stroke-width="1"/>`,
    // 腰省
    dart(cx - 22, 230, 320, 36),
    dart(cx + 22, 230, 320, 36),
    // 侧腰收省
    `<path d="M${cx - waist * 0.4} ${300} C${cx - waist * 0.38} ${310} ${cx - hip * 0.34} ${330} ${cx - hip * 0.38} ${360}" fill="none" stroke="#333" stroke-width="0.8"/>`,
    `<path d="M${cx + waist * 0.4} ${300} C${cx + waist * 0.38} ${310} ${cx + hip * 0.34} ${330} ${cx + hip * 0.38} ${360}" fill="none" stroke="#333" stroke-width="0.8"/>`,
    // 腰带（如有）
    hasWaistband
      ? `<rect x="${cx - waist * 0.42}" y="312" width="${waist * 0.84}" height="16" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`
      : "",
    // 下摆缝线
    stitchLine(cx - hem * 0.43, h - 22, cx + hem * 0.43, h - 22),
    // 腋下
    `<path d="M${cx - 36} ${130} C${cx - 38} ${140} ${cx - 34} ${180} ${cx - 30} ${200}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    `<path d="M${cx + 36} ${130} C${cx + 38} ${140} ${cx + 34} ${180} ${cx + 30} ${200}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
  ].join("")
}

/** 裤装 */
function pantSketch(look: GeneratedLook, customer: CustomerProfile): string {
  const w = 400, h = 640
  const cx = w / 2
  const isWide = look.keyDetails.some((d) => /阔腿|宽腿|直筒/.test(d))
  const waistW = 100
  const hemW = isWide ? 120 : 70

  return [
    // 腰头
    `<rect x="${cx - waistW * 0.45}" y="40" width="${waistW * 0.9}" height="24" fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    // 门襟
    `<path d="M${cx} ${64} L${cx - 8} ${64} L${cx - 8} ${140} L${cx} ${150}" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>`,
    // 左腿
    `<path d="M${cx} ${64} L${cx - waistW * 0.45} ${64} C${cx - waistW * 0.48} ${120} ${cx - hemW * 0.22} ${300} ${cx - hemW * 0.38} ${h - 20}
             L${cx - 8} ${h - 20} L${cx - 8} ${460} C${cx - 4} ${240} ${cx - 2} ${120} ${cx} ${64}" fill="#fafafa" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 右腿
    `<path d="M${cx} ${64} L${cx + waistW * 0.45} ${64} C${cx + waistW * 0.48} ${120} ${cx + hemW * 0.22} ${300} ${cx + hemW * 0.38} ${h - 20}
             L${cx + 8} ${h - 20} L${cx + 8} ${460} C${cx + 4} ${240} ${cx + 2} ${120} ${cx} ${64}" fill="#fafafa" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 裤中线
    `<line x1="${cx - 30}" y1="64" x2="${cx - hemW * 0.36}" y2="${h - 20}" stroke="#999" stroke-width="0.5" stroke-dasharray="10 6"/>`,
    `<line x1="${cx + 30}" y1="64" x2="${cx + hemW * 0.36}" y2="${h - 20}" stroke="#999" stroke-width="0.5" stroke-dasharray="10 6"/>`,
    // 侧口袋
    `<path d="M${cx - waistW * 0.45} ${74} C${cx - waistW * 0.4} ${100} ${cx - 38} ${120} ${cx - 30} ${130}" fill="none" stroke="#333" stroke-width="1.2"/>`,
    `<path d="M${cx + waistW * 0.45} ${74} C${cx + waistW * 0.4} ${100} ${cx + 38} ${120} ${cx + 30} ${130}" fill="none" stroke="#333" stroke-width="1.2"/>`,
    // 扣子
    button(cx - 4, 52),
    // 裤脚缝线
    stitchLine(cx - hemW * 0.37, h - 22, cx - 6, h - 22),
    stitchLine(cx + 6, h - 22, cx + hemW * 0.37, h - 22),
    // 腰头缝线
    stitchLine(cx - waistW * 0.44, 54, cx + waistW * 0.44, 54),
  ].join("")
}

/** 上装 / 衬衫 / T恤 */
function topSketch(look: GeneratedLook, customer: CustomerProfile): string {
  const w = 400, h = 500
  const cx = w / 2
  const isShirt = look.keyDetails.some((d) => /衬衫|立领|翻领/.test(d))
  const isKnit = look.keyDetails.some((d) => /针织|螺纹|卫衣/.test(d))

  return [
    // 廓形
    `<path d="M${cx} ${30} C${cx - 24} ${30} ${cx - 40} ${74} ${cx - 44} ${120}
             C${cx - 44} ${180} ${cx - 34} ${260} ${cx - 36} ${h - 16}
             L${cx} ${h - 16}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    `<path d="M${cx} ${30} C${cx + 24} ${30} ${cx + 40} ${74} ${cx + 44} ${120}
             C${cx + 44} ${180} ${cx + 34} ${260} ${cx + 36} ${h - 16}
             L${cx} ${h - 16}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    // 领型
    isShirt
      ? [
          `<path d="M${cx - 20} ${40} L${cx - 46} ${82} L${cx - 14} ${102} L${cx} ${92}
                   L${cx + 14} ${102} L${cx + 46} ${82} L${cx + 20} ${40}" fill="#f5f5f5" stroke="#1a1a1a" stroke-width="1.5"/>`,
          `<line x1="${cx}" y1="40" x2="${cx}" y2="${h - 16}" stroke="#1a1a1a" stroke-width="1.2"/>`,
          ...[80, 138, 196, 254, 312].map((y) => button(cx + 10, y)),
        ].join("")
      : `<path d="M${cx - 20} ${40} C${cx - 14} ${28} ${cx - 4} ${24} ${cx} ${24} C${cx + 4} ${24} ${cx + 14} ${28} ${cx + 20} ${40}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 袖窿
    `<path d="M${cx - 44} ${120} C${cx - 46} ${140} ${cx - 38} ${200} ${cx - 34} ${240}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    `<path d="M${cx + 44} ${120} C${cx + 46} ${140} ${cx + 38} ${200} ${cx + 34} ${240}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 下摆
    stitchLine(cx - 35, h - 18, cx + 35, h - 18),
    isKnit
      ? [
          `<rect x="${cx - 36}" y="${h - 22}" width="72" height="10" rx="2" fill="none" stroke="#1a1a1a" stroke-width="1.2"/>`,
          stitchLine(cx - 35, h - 14, cx + 35, h - 14),
        ].join("")
      : "",
  ].join("")
}

/** 马甲 */
function vestSketch(look: GeneratedLook, customer: CustomerProfile): string {
  const w = 400, h = 520
  const cx = w / 2

  return [
    // 廓形
    `<path d="M${cx} ${40} C${cx - 18} ${40} ${cx - 34} ${80} ${cx - 38} ${130}
             C${cx - 38} ${260} ${cx - 30} ${360} ${cx - 34} ${h - 16}
             L${cx} ${h - 16}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    `<path d="M${cx} ${40} C${cx + 18} ${40} ${cx + 34} ${80} ${cx + 38} ${130}
             C${cx + 38} ${260} ${cx + 30} ${360} ${cx + 34} ${h - 16}
             L${cx} ${h - 16}"
          fill="#fafafa" stroke="#1a1a1a" stroke-width="1.8"/>`,
    // V领
    `<path d="M${cx - 16} ${48} L${cx} ${140} L${cx + 16} ${48}" fill="none" stroke="#1a1a1a" stroke-width="1.5"/>`,
    // 门襟
    `<line x1="${cx}" y1="140" x2="${cx}" y2="${h - 16}" stroke="#1a1a1a" stroke-width="1.2"/>`,
    // 扣子
    ...[190, 260, 330, 400].map((y) => button(cx + 10, y)),
    // 侧缝
    `<path d="M${cx - 38} ${130} C${cx - 6} ${180} ${cx - 4} ${280} ${cx - 34} ${h - 16}" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>`,
    `<path d="M${cx + 38} ${130} C${cx + 6} ${180} ${cx + 4} ${280} ${cx + 34} ${h - 16}" fill="none" stroke="#1a1a1a" stroke-width="1.3"/>`,
    // 下摆
    stitchLine(cx - 33, h - 18, cx + 33, h - 18),
  ].join("")
}

// ─── 主入口 ──────────────────────────────────────────────────────────────
export function buildTechSketchSVG(
  look: GeneratedLook,
  _customer?: CustomerProfile
): string {
  const title = look.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")
  const details = look.keyDetails.slice(0, 4).join(" / ")
  const palette = look.palette || ["#333333", "#666666", "#999999"]

  // 判断品类
  const isDress = /裙|连衣裙|纱裙|长裙|半身裙/.test(look.title)
  const isPant = /裤|牛仔|短裤|长裤|西裤/.test(look.title)
  const isVest = /马甲|背心/.test(look.title)
  const isJacket = /外套|夹克|大衣|风衣|西装/.test(look.title)

  const garmentSVG = isDress
    ? dressSketch(look, _customer!)
    : isPant
      ? pantSketch(look, _customer!)
      : isVest
        ? vestSketch(look, _customer!)
        : isJacket
          ? jacketSketch(look, _customer!)
          : topSketch(look, _customer!)

  const garmentTypeLabel = isDress ? "连衣裙" : isPant ? "裤装" : isVest ? "马甲" : isJacket ? "夹克/外套" : "上装"

  // ─── 尺寸标注 ──────────────────────────────────────────────────
  const dimLine = (y: number, label: string) => `
    <g transform="translate(470, ${y})">
      <text x="0" y="0" font-family="sans-serif" font-size="11" fill="#555">${label}</text>
    </g>`

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 750">`,
    fabricDefs,
    // 背景
    `<rect width="620" height="750" fill="#ffffff"/>`,
    // 标题区
    `<text x="30" y="36" font-family="sans-serif" font-size="18" font-weight="700" fill="#1a1a1a">${title}</text>`,
    `<text x="30" y="56" font-family="sans-serif" font-size="11" fill="#888">${garmentTypeLabel} 技术线稿 · ${details}</text>`,
    // 分割线
    `<line x1="30" y1="66" x2="590" y2="66" stroke="#ddd" stroke-width="0.5"/>`,
    // 款式图主体
    `<g transform="translate(20, 70)">${garmentSVG}</g>`,
    // 尺寸标注区
    `<g transform="translate(450, 70)">`,
    `<line x1="0" y1="0" x2="0" y2="650" stroke="#eee" stroke-width="0.5"/>`,
    `<text x="10" y="30" font-family="sans-serif" font-size="10" font-weight="700" fill="#1a1a1a">尺寸标注</text>`,
    `<text x="10" y="48" font-family="sans-serif" font-size="9" fill="#888">单位：cm</text>`,
    ...[
      { y: 80, label: "衣长/裤长: ____" },
      { y: 110, label: "胸围/腰围: ____" },
      { y: 140, label: "肩宽: ____" },
      { y: 170, label: "袖长: ____" },
      { y: 200, label: "领围: ____" },
      { y: 230, label: "下摆: ____" },
    ].map(({ y, label }) => `<text x="10" y="${y}" font-family="sans-serif" font-size="9" fill="#555">${label}</text>`),
    `</g>`,
    // 配色小样
    `<g transform="translate(30, 700)">`,
    `<text x="0" y="0" font-family="sans-serif" font-size="10" font-weight="700" fill="#1a1a1a">配色参考</text>`,
    ...palette.map((c, i) =>
      `<rect x="${i * 52}" y="8" width="44" height="18" fill="${c}" stroke="#ccc" stroke-width="0.5" rx="2"/><text x="${i * 52 + 22}" y="36" font-family="sans-serif" font-size="7" fill="#888" text-anchor="middle">${c}</text>`
    ),
    `</g>`,
    // 脚注
    `<text x="330" y="720" font-family="sans-serif" font-size="8" fill="#bbb" text-anchor="middle">智衣Design · AI 定向设计 · 矢量线稿可导入 Illustrator 编辑</text>`,
    `</svg>`,
  ].join("")
}

/** 导出为下载 */
export function downloadTechSketch(look: GeneratedLook, customer?: CustomerProfile) {
  const svg = buildTechSketchSVG(look, customer)
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${look.title.replace(/[<>:"/\\|?*]/g, "_")}_线稿.svg`
  a.click()
  URL.revokeObjectURL(url)
}

/** 获取线稿 data URL（用于在UI中预览） */
export function getTechSketchDataURL(look: GeneratedLook, customer?: CustomerProfile): string {
  const svg = buildTechSketchSVG(look, customer)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/**
 * 把技术线稿 SVG 栅格化为 PNG data URL（结构控制参考图用）
 * 火山方舟不接受 SVG data URI，必须转成位图才能作为参考图传入
 */
export function getTechSketchPngDataURL(
  look: GeneratedLook,
  customer?: CustomerProfile,
  width = 1024,
  height = 1280
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const svg = buildTechSketchSVG(look, customer)
      const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) { resolve(null); return }
          ctx.fillStyle = "#ffffff"
          ctx.fillRect(0, 0, width, height)
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL("image/png"))
        } catch {
          resolve(null)
        }
      }
      img.onerror = () => resolve(null)
      img.src = svgUrl
    } catch {
      resolve(null)
    }
  })
}
