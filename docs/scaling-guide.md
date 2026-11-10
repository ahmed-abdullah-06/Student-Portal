# Scaling guide

Start with vertical scaling when CPU, memory, or PostgreSQL connection utilization is persistently above 70% during peak periods.

1. Increase application replicas behind Caddy once the API is stateless and uploads use S3-compatible storage.
2. Move PostgreSQL to a managed HA service before adding read replicas.
3. Add a read replica for reporting and dashboard queries; keep registration, payments, and writes on the primary.
4. Partition operational dashboards by tenant and time range before considering sharding.
5. Shard tenants only after measuring sustained primary saturation and documenting a tenant migration plan.

Every scaling change must include load-test evidence, database connection-pool sizing, alert thresholds, and a rollback plan.
