/**
 * 位图 → 矢量 (SVG) 转换
 * 使用 imagetracerjs（CDN 全局引入）将 PNG/JPEG 线稿图 trace 为可编辑 SVG 路径
 */

// CDN 加载后挂载到 window.ImageTracer
function getTracer() {
  const tracer = (window as any).ImageTracer
  if (!tracer) throw new Error("ImageTracer 库未加载，请刷新页面重试")
  return tracer
}

export async function traceToVector(imageUrl: string): Promise<string> {
  // 1. 加载图片
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = "anonymous"
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("图片加载失败，请确认线稿图已生成"))
    el.src = imageUrl
  })

  // 2. 绘制到 canvas
  const canvas = document.createElement("canvas")
  canvas.width = Math.min(img.width, 2048)  // 限制尺寸避免太慢
  canvas.height = Math.min(img.height, 2048)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  // 3. 用 imagetracer 将 canvas data URL trace 为 SVG
  const tracer = getTracer()
  const svg = await new Promise<string>((resolve, reject) => {
    try {
      tracer.imageToSVG(
        canvas.toDataURL("image/png"),
        (output: string) => {
          if (!output || output.length < 100) {
            reject(new Error("trace 结果为空，图片可能不适合矢量化"))
            return
          }
          resolve(output)
        },
        {
          ltres: 1,
          qtres: 1,
          pathomit: 8,
          numberofcolors: 2,
          scale: 1,
          viewbox: true,
          desc: false,
        }
      )
    } catch (err: any) {
      reject(new Error(`trace 异常：${err?.message || "未知"}`))
    }
  })

  return svg
}

/** 下载 SVG 矢量文件 */
export function downloadVectorSVG(svgText: string, filename: string) {
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
