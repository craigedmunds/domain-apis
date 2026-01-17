# Traefik Ingress Helm Chart

A Helm chart for creating Traefik ingress resources with environment-specific domain patterns and TLS configuration. This chart eliminates the need for repetitive Traefik annotations and complex kustomize patches by providing a reusable template for ingress resources.

## Features

- **Environment-aware domain generation**: Automatically generates internal and external domain patterns
- **Access pattern control**: Support for internal-only and public (internal+external) access patterns
- **TLS integration**: Built-in cert-manager integration with automatic certificate secret generation
- **Traefik optimization**: Pre-configured Traefik-specific annotations and settings
- **Flexible configuration**: Supports custom subdomains, annotations, and service configurations

## Usage

### Basic Internal-Only Ingress

```yaml
service:
  name: "my-service"
  namespace: "my-namespace"

domains:
  localDomainSuffix: "lab.local.ctoaas.co"

tls:
  enabled: true
  issuer: "letsencrypt-prod"
```

This creates an ingress accessible at `my-service.lab.local.ctoaas.co` with automatic TLS.

### Public Ingress (Internal + External)

```yaml
service:
  name: "my-service"
  namespace: "my-namespace"

ingress:
  accessPattern: "public"

domains:
  localDomainSuffix: "lab.local.ctoaas.co"
  publicDomainSuffix: "lab.ctoaas.co"

tls:
  enabled: true
  issuer: "letsencrypt-prod"
```

This creates an ingress accessible at both:
- `my-service.lab.local.ctoaas.co` (internal)
- `my-service.lab.ctoaas.co` (external)

### Custom Subdomain

```yaml
service:
  name: "my-service"
  namespace: "my-namespace"

domains:
  subdomain: "api"
  localDomainSuffix: "lab.local.ctoaas.co"
```

This creates an ingress accessible at `api.my-service.lab.local.ctoaas.co`.

### Local Development

```yaml
service:
  name: "my-service"
  namespace: "my-namespace"

domains:
  localDomainSuffix: "127.0.0.1.nip.io"

tls:
  enabled: false  # Disable TLS for local development
```

## Integration with Kustomize

This chart is designed to work with kustomize's `helmCharts` feature:

```yaml
# kustomization.yaml
helmCharts:
- name: traefik-ingress
  releaseName: my-service-ingress
  chartHome: ../../../helm
  valuesInline:
    service:
      name: my-service
      namespace: my-namespace
    domains:
      localDomainSuffix: lab.local.ctoaas.co
    tls:
      enabled: true
      issuer: letsencrypt-prod
```

## Values Reference

| Parameter | Description | Default |
|-----------|-------------|---------|
| `service.name` | Name of the service to expose | `""` (required) |
| `service.namespace` | Namespace where the service is located | `""` (required) |
| `service.port.name` | Service port name | `"http"` |
| `service.port.number` | Service port number | `80` |
| `ingress.name` | Override ingress name | `service.name` |
| `ingress.className` | Ingress class name | `"traefik"` |
| `ingress.path` | Path pattern | `"/"` |
| `ingress.pathType` | Path type | `"Prefix"` |
| `ingress.accessPattern` | Access pattern: "internal" or "public" | `"internal"` |
| `domains.localDomainSuffix` | Internal domain suffix | `"127.0.0.1.nip.io"` |
| `domains.publicDomainSuffix` | External domain suffix (public only) | `""` |
| `domains.subdomain` | Custom subdomain prefix | `""` |
| `tls.enabled` | Enable TLS termination | `false` |
| `tls.issuer` | cert-manager cluster issuer | `""` |
| `tls.secretName` | Override TLS secret name | Auto-generated |
| `traefik.router.entrypoints` | Traefik entrypoints | `"websecure"` |
| `traefik.router.tls` | Enable TLS on router | `true` |
| `traefik.annotations` | Additional Traefik annotations | `{}` |
| `annotations` | Additional ingress annotations | `{}` |
| `labels` | Additional ingress labels | `{}` |

## Generated Labels

The chart automatically adds management labels based on the access pattern:

- **Internal access**: `ingress.ctoaas.co/managed: "true"`
- **Public access**: `ingress.ctoaas.co/managed-public: "true"`

These labels are used by the ingress management system for additional transformations.

## TLS Secret Naming

When TLS is enabled and no custom secret name is provided, the chart generates secret names using the pattern:
- Internal: `{ingress-name}-{domain-suffix-with-dashes}-tls`
- Public: `{ingress-name}-{public-domain-suffix-with-dashes}-tls`

Examples:
- `my-service-lab-local-ctoaas-tls`
- `my-service-lab-ctoaas-tls`