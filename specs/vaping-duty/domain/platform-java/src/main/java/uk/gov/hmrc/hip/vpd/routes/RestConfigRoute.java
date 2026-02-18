package uk.gov.hmrc.hip.vpd.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;
import org.eclipse.microprofile.config.inject.ConfigProperty;

/**
 * REST configuration and entry-point routing.
 *
 * <p>Java DSL equivalent of {@code rest-config.yaml}.
 *
 * <p>Configures:
 * <ul>
 *   <li>platform-http component on the port set by {@code quarkus.http.port}</li>
 *   <li>POST /duty/vpd/submission-returns/v1 → direct:postSubmissionReturn</li>
 *   <li>GET  /duty/vpd/submission-returns/v1 → direct:getSubmission</li>
 *   <li>GET  /health                         → inline 200 UP response</li>
 * </ul>
 */
@ApplicationScoped
public class RestConfigRoute extends RouteBuilder {

    @ConfigProperty(name = "quarkus.http.port", defaultValue = "8082")
    int port;

    @Override
    public void configure() {

        // -----------------------------------------------------------------
        // REST configuration
        // -----------------------------------------------------------------
        restConfiguration()
                .component("platform-http")
                .bindingMode("off");

        // -----------------------------------------------------------------
        // REST endpoint definitions
        // -----------------------------------------------------------------
        rest("/duty/vpd/submission-returns/v1")
                .get().to("direct:getSubmission")
                .post().to("direct:postSubmissionReturn");

        rest("/health")
                .get().to("direct:health");

        // -----------------------------------------------------------------
        // Route: getSubmission entry point
        // Routes to getSubmissionReturnByAck or getSubmissionReturnByApproval
        // based on which query parameters are present.
        //
        // Mirrors rest-config.yaml#getSubmission
        // -----------------------------------------------------------------
        from("direct:getSubmission")
                .routeId("getSubmission")

                // Remove the bracket-encoded header that Camel creates from
                // the fields[submission-returns] query param
                .removeHeader("fields[submission-returns]")

                // Store correlation ID and query params as exchange properties
                .setProperty("correlationId", header("X-Correlation-Id"))
                .setProperty("ackRef", header("acknowledgementReference"))
                .setProperty("approvalNumber", header("vpdApprovalNumber"))
                .setProperty("periodKey", header("periodKey"))

                // Parse fields[submission-returns] from raw query string
                // (brackets get URL-encoded, so we can't use simple header access)
                .setProperty("fieldsParam", exchange -> {
                    String rawQuery = exchange.getIn().getHeader("CamelHttpRawQuery", String.class);
                    if (rawQuery == null) return null;
                    for (String param : rawQuery.split("&")) {
                        if (param.startsWith("fields%5Bsubmission-returns%5D=")
                                || param.startsWith("fields[submission-returns]=")) {
                            String value = param.split("=", 2)[1];
                            return java.net.URLDecoder.decode(value, java.nio.charset.StandardCharsets.UTF_8);
                        }
                    }
                    return null;
                })

                // Route based on which query parameters are present
                .choice()
                    .when(exchangeProperty("ackRef").isNotNull())
                        .to("direct:getSubmissionReturnByAck")
                    .when(exchangeProperty("approvalNumber").isNotNull()
                            .and(exchangeProperty("periodKey").isNotNull()))
                        .to("direct:getSubmissionReturnByApproval")
                    .otherwise()
                        .setHeader("CamelHttpResponseCode", constant(400))
                        .setBody(constant(
                                "{\"code\": \"BAD_REQUEST\", \"message\": " +
                                "\"Either acknowledgementReference OR " +
                                "(vpdApprovalNumber AND periodKey) query parameters are required\"}"))
                        .setHeader("Content-Type", constant("application/json"))
                .end();
    }
}
