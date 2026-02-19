package uk.gov.hmrc.hip.vpd.config;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.CamelContext;
import org.apache.camel.component.http.HttpClientConfigurer;
import org.apache.camel.component.http.HttpComponent;
import org.apache.camel.quarkus.core.CamelContextCustomizer;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.HttpClientBuilder;

/**
 * Disables the automatic TLS upgrade negotiation that Apache HttpClient 5
 * performs by default ({@code Upgrade: TLS/1.2}, {@code Connection: Upgrade}).
 *
 * <p>Without this, Envoy rejects every backend call with 403 because it sees
 * an upgrade request on a route with no {@code upgrade_type} configured:
 * <pre>
 *   req_connection: "keep-alive, Upgrade"
 *   req_upgrade:    "TLS/1.2"
 *   response_flags: "-"   (local reject, duration_ms: 0)
 * </pre>
 *
 * <p>Implemented as a {@link CamelContextCustomizer} so Quarkus Camel invokes
 * it before routes start, guaranteeing the configurer is registered on the
 * HTTP component regardless of CDI autowiring order.
 */
@ApplicationScoped
public class NoUpgradeHttpClientConfigurer implements CamelContextCustomizer {

    @Override
    public void customize(CamelContext camelContext) {
        HttpComponent http = camelContext.getComponent("http", HttpComponent.class);
        if (http != null) {
            http.setHttpClientConfigurer(new HttpClientConfigurer() {
                @Override
                public void configureHttpClient(HttpClientBuilder clientBuilder) {
                    clientBuilder.setDefaultRequestConfig(
                            RequestConfig.custom()
                                    .setProtocolUpgradeEnabled(false)
                                    .build()
                    );
                }
            });
        }
    }
}
