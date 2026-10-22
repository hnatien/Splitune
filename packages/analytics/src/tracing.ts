import { type Attributes, type Span, SpanStatusCode, trace } from '@opentelemetry/api'

// Optional OpenTelemetry traces (16 §1; personal mode: a local grafana/otel-lgtm container, or
// Railway tracing on `app`). Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set; then spans go to
// <endpoint>/v1/traces over OTLP/HTTP. The SDK is only imported then. Span attributes carry ids,
// stages and machine codes, never URLs (presigned URLs are credentials) or user content. Spans of
// one analysis share the `analysis_id` attribute across the API and the workers.

export async function startTracing(
  serviceName: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const { OTEL_EXPORTER_OTLP_ENDPOINT: endpoint, OTEL_SERVICE_NAME } = env
  if (!endpoint) return false
  const [
    { NodeTracerProvider },
    { BatchSpanProcessor },
    { OTLPTraceExporter },
    { resourceFromAttributes },
  ] = await Promise.all([
    import('@opentelemetry/sdk-trace-node'),
    import('@opentelemetry/sdk-trace-base'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/resources'),
  ])
  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({ 'service.name': OTEL_SERVICE_NAME || serviceName }),
    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${endpoint.replace(/\/+$/, '')}/v1/traces` }),
      ),
    ],
  })
  provider.register()
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void provider.forceFlush())
  }
  return true
}

// Runs `fn` inside a span; a no-op span while tracing is off.
export function inSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return trace.getTracer('splitune').startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span)
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR })
      span.setAttribute('error.type', error instanceof Error ? error.name : typeof error)
      throw error
    } finally {
      span.end()
    }
  })
}
