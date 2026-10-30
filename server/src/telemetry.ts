import type { AppConfig } from "./config/index.js";

type TelemetryConfig = Pick<
  AppConfig,
  | "otelEnabled"
  | "otelExporterOtlpEndpoint"
  | "otelServiceName"
  | "serviceName"
  | "nodeEnv"
>;

type TelemetrySdk = {
  shutdown: () => Promise<void>;
};

let sdk: TelemetrySdk | undefined;

/**
 * Start optional OpenTelemetry instrumentation.
 *
 * Imports are lazy so the SDK is never loaded when tracing is disabled. The
 * pino instrumentation injects `trace_id` and `span_id` into log records.
 */
export async function startTelemetry(config: TelemetryConfig): Promise<void> {
  if (!config.otelEnabled || sdk) {
    return;
  }

  const [
    { NodeSDK },
    { OTLPTraceExporter },
    { PinoInstrumentation },
    { resourceFromAttributes },
    { ATTR_SERVICE_NAME, ATTR_DEPLOYMENT_ENVIRONMENT_NAME },
  ] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/exporter-trace-otlp-http"),
    import("@opentelemetry/instrumentation-pino"),
    import("@opentelemetry/resources"),
    import("@opentelemetry/semantic-conventions"),
  ]);

  const exporter = new OTLPTraceExporter(
    config.otelExporterOtlpEndpoint
      ? { url: config.otelExporterOtlpEndpoint }
      : {},
  );

  const instance = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.otelServiceName || config.serviceName,
      [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.nodeEnv,
    }),
    traceExporter: exporter,
    instrumentations: [new PinoInstrumentation()],
  });

  instance.start();
  sdk = instance as TelemetrySdk;
}

export async function stopTelemetry(): Promise<void> {
  if (!sdk) return;
  const instance = sdk;
  sdk = undefined;
  await instance.shutdown();
}
