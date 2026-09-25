# SETU KEDA autoscaling

These manifests require the KEDA operator to be installed in the Kubernetes cluster.
They use KEDA's Kafka scaler to scale workers from real consumer-group lag rather than CPU alone.

Install KEDA once per cluster using the official KEDA installation method, then apply SETU's Kustomize overlay.

The Kafka broker is kept internal (`setu-kafka:9092`). For managed Kafka, replace `bootstrapServers` and add the appropriate KEDA Kafka authentication (`TriggerAuthentication` / TLS / SASL) before production use.

The minimum replica counts intentionally stay above zero for SETU's order/payment/dispatch workloads.
