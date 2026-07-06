declare module "imagetracerjs" {
  interface ImageTracerOptions {
    ltres?: number
    qtres?: number
    pathomit?: number
    colorsampling?: number
    numberofcolors?: number
    mincolorratio?: number
    colorquantcycles?: number
    scale?: number
    simplifysvgpath?: boolean
    layercontainerid?: string
    lcpr?: number
    qcpr?: number
    desc?: boolean
    viewbox?: boolean
    blurradius?: number
    blurdelta?: number
  }

  function imageToSVG(
    imageUrl: string,
    callback: (svgString: string) => void,
    options?: ImageTracerOptions
  ): void

  function imageToSVG(
    imageUrl: string,
    options?: ImageTracerOptions
  ): string

  export default { imageToSVG }
}
