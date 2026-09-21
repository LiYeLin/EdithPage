/** Only the poly-decomp API consumed by Matter's concave-polygon decomposition is declared here. */
declare module 'poly-decomp' {
  type Polygon = [number, number][]
  const decomp: {
    makeCCW(polygon: Polygon): boolean
    isSimple(polygon: Polygon): boolean
    removeCollinearPoints(polygon: Polygon, threshold: number): number
    removeDuplicatePoints(polygon: Polygon, precision: number): void
    quickDecomp(polygon: Polygon): Polygon[]
  }
  export default decomp
}
