/** maplibre-contour DemSource 替身：记录构造参数、协议注册与生成的等高线 URL */
export function createFakeDemSource() {
  const instances: FakeDemSource[] = []

  class FakeDemSource {
    readonly options: Record<string, unknown>
    readonly sharedDemProtocolId: string
    readonly contourProtocolId: string
    setupCalls: unknown[] = []

    constructor(options: Record<string, unknown>) {
      this.options = options
      const prefix = `dem${instances.length || ''}`
      this.sharedDemProtocolId = `${prefix}-shared`
      this.contourProtocolId = `${prefix}-contour`
      instances.push(this)
    }

    setupMaplibre = (maplibre: unknown) => {
      this.setupCalls.push(maplibre)
    }

    contourProtocolUrl = (options: Record<string, unknown>) =>
      `${this.contourProtocolId}://{z}/{x}/{y}?${JSON.stringify(options)}`
  }

  return { instances, DemSource: FakeDemSource }
}

export type FakeDemSource = InstanceType<ReturnType<typeof createFakeDemSource>['DemSource']>
