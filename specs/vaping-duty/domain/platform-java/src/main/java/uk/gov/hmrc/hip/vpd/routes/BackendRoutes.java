package uk.gov.hmrc.hip.vpd.routes;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import uk.gov.hmrc.hip.vpd.service.XmlTransformer;

/**
 * Backend service client routes.
 *
 * <p>Java DSL equivalent of the Camel Kamelets. In the YAML DSL, each backend
 * call is encapsulated in a Kamelet. In Java, we use {@code direct:} routes
 * instead — the same logical unit of encapsulation, but implemented as named
 * sub-routes that the orchestration routes call via {@code to("direct:...")}.
 *
 * <p>Key difference from the YAML Kamelets: because the Kamelet routing bug
 * (intermittent route-ID collision under rapid load) does not affect Java
 * {@code direct:} routes, we don't need the "/ack-tp" suffix workaround.
 * Each route has a stable, unique ID and can be safely reused.
 *
 * <p>Routes provided (mirrors the 7 kamelets):
 * <ul>
 *   <li>direct:excise-getRegistration   — GET XML, transform to JSON</li>
 *   <li>direct:excise-getPeriod         — GET XML, transform to JSON</li>
 *   <li>direct:excise-validateAndCalc   — POST JSON→XML, transform response to JSON</li>
 *   <li>direct:tax-platform-getSubmission  — GET JSON</li>
 *   <li>direct:tax-platform-findSubmission — GET JSON (by approval+period)</li>
 *   <li>direct:tax-platform-storeSubmission — POST JSON</li>
 *   <li>direct:customer-getCustomer     — GET JSON</li>
 * </ul>
 *
 * <p>Each route reads its input from exchange properties set by the calling
 * route, performs the HTTP call, and stores its result back as an exchange
 * property — same contract as the Kamelets.
 */
@ApplicationScoped
public class BackendRoutes extends RouteBuilder {

    @ConfigProperty(name = "vpd.backend.excise.url", defaultValue = "http://excise-proxy:4010")
    String exciseUrl;

    @ConfigProperty(name = "vpd.backend.customer.url", defaultValue = "http://customer-proxy:4010")
    String customerUrl;

    @ConfigProperty(name = "vpd.backend.tax-platform.url", defaultValue = "http://tax-platform-proxy:4010")
    String taxPlatformUrl;

    @Inject
    XmlTransformer xmlTransformer;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void configure() {

        // -----------------------------------------------------------------
        // Excise: GET registration by vpdApprovalNumber
        // Mirrors: excise-getRegistration.kamelet.yaml
        //
        // Reads:  exchangeProperty.vpdApprovalNumber
        // Writes: exchangeProperty.exciseRegistrationResponse (JSON)
        //         exchangeProperty.customerId (extracted from XML)
        // -----------------------------------------------------------------
        from("direct:excise-getRegistration")
                .routeId("excise-getRegistration")
                .process(exchange -> {
                    String approvalNumber = exchange.getProperty("vpdApprovalNumber", String.class);
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "GET");
                    exchange.getIn().setHeader("Accept", "application/xml");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(null);
                })
                .toD(exciseUrl + "/excise/vpd/registrations/${exchangeProperty.vpdApprovalNumber}"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    int statusCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
                    exchange.setProperty("exciseRegistrationResponseCode", statusCode);

                    if (statusCode >= 400) {
                        log.warn("Excise registration error: {} - {}", statusCode,
                                exchange.getIn().getBody(String.class));
                        exchange.setProperty("exciseRegistrationError",
                                exchange.getIn().getBody(String.class));
                    } else {
                        String xml = exchange.getIn().getBody(String.class);
                        String json = xmlTransformer.registrationXmlToJson(xml);
                        String customerId = xmlTransformer.extractCustomerIdFromRegistration(xml);

                        // Only set customerId if not already present (GET by ack flow
                        // gets it from tax-platform; approval flow gets it here)
                        if (customerId != null && !customerId.isBlank()
                                && exchange.getProperty("customerId") == null) {
                            exchange.setProperty("customerId", customerId);
                        }
                        exchange.setProperty("exciseRegistrationResponse", json);
                        exchange.getIn().setBody(json);
                    }
                });

        // -----------------------------------------------------------------
        // Excise: GET period by periodKey
        // Mirrors: excise-getPeriod.kamelet.yaml
        //
        // Reads:  exchangeProperty.periodKey
        // Writes: exchangeProperty.excisePeriodResponse (JSON)
        // -----------------------------------------------------------------
        from("direct:excise-getPeriod")
                .routeId("excise-getPeriod")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "GET");
                    exchange.getIn().setHeader("Accept", "application/xml");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(null);
                })
                .toD(exciseUrl + "/excise/vpd/periods/${exchangeProperty.periodKey}"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    int statusCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
                    exchange.setProperty("excisePeriodResponseCode", statusCode);

                    if (statusCode >= 400) {
                        log.warn("Excise period error: {} - {}", statusCode,
                                exchange.getIn().getBody(String.class));
                        exchange.setProperty("excisePeriodError",
                                exchange.getIn().getBody(String.class));
                    } else {
                        String xml = exchange.getIn().getBody(String.class);
                        String json = xmlTransformer.periodXmlToJson(xml);
                        exchange.setProperty("excisePeriodResponse", json);
                        exchange.getIn().setBody(json);
                    }
                });

        // -----------------------------------------------------------------
        // Excise: POST validate-and-calculate
        // Mirrors: excise-validateAndCalculate.kamelet.yaml
        //
        // Reads:  exchangeProperty.requestBody (JSON to POST)
        // Writes: exchangeProperty.exciseValidationResponse (JSON)
        //         exchangeProperty.exciseResponseCode
        //         exchangeProperty.validationValid (boolean)
        //         exchangeProperty.customerId
        // -----------------------------------------------------------------
        from("direct:excise-validateAndCalc")
                .routeId("excise-validateAndCalc")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "POST");
                    exchange.getIn().setHeader("Content-Type", "application/json");
                    exchange.getIn().setHeader("Accept", "application/xml");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(exchange.getProperty("requestBody", String.class));
                })
                .to(exciseUrl + "/excise/vpd/validate-and-calculate"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    int statusCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
                    exchange.setProperty("exciseResponseCode", statusCode);

                    if (statusCode >= 400) {
                        log.error("Excise validation error: {} - {}", statusCode,
                                exchange.getIn().getBody(String.class));
                        exchange.setProperty("exciseValidationError",
                                exchange.getIn().getBody(String.class));
                    } else {
                        String xml = exchange.getIn().getBody(String.class);
                        XmlTransformer.ValidationResult result =
                                xmlTransformer.validateAndCalculateXmlToJson(xml);

                        exchange.setProperty("validationValid", result.valid());
                        exchange.setProperty("customerId", result.customerId());
                        exchange.setProperty("exciseValidationResponse", result.json());
                        exchange.getIn().setBody(result.json());
                    }
                });

        // -----------------------------------------------------------------
        // Tax Platform: GET submission by acknowledgementReference
        // Mirrors: tax-platform-getSubmission.kamelet.yaml
        //
        // Reads:  exchangeProperty.ackRef
        // Writes: exchangeProperty.taxPlatformResponse (JSON)
        //         exchangeProperty.customerId (extracted from response)
        //         exchangeProperty.vpdApprovalNumber (extracted from response)
        //         exchangeProperty.periodKey (extracted from response)
        // -----------------------------------------------------------------
        from("direct:tax-platform-getSubmission")
                .routeId("tax-platform-getSubmission")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "GET");
                    exchange.getIn().setHeader("Accept", "application/json");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(null);
                })
                .toD(taxPlatformUrl + "/submissions/vpd/${exchangeProperty.ackRef}"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    Integer statusCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
                    String body = exchange.getIn().getBody(String.class);
                    log.debug("Tax-platform getSubmission raw response: status={} body={}", statusCode, body);
                    exchange.setProperty("taxPlatformResponseCode", statusCode != null ? statusCode : 500);
                    exchange.setProperty("taxPlatformResponse", body);

                    if (statusCode != null && statusCode < 400) {
                        try {
                            JsonNode json = objectMapper.readTree(body);
                            log.debug("Tax-platform parsed JSON fields: customerId={} vpdApprovalNumber={} periodKey={}",
                                    json.path("customerId"), json.path("vpdApprovalNumber"), json.path("periodKey"));
                            String customerId = json.path("customerId").asText(null);
                            String approvalNumber = json.path("vpdApprovalNumber").asText(null);
                            String periodKey = json.path("periodKey").asText(null);
                            if (customerId != null && !customerId.isEmpty())
                                exchange.setProperty("customerId", customerId);
                            if (approvalNumber != null && !approvalNumber.isEmpty())
                                exchange.setProperty("vpdApprovalNumber", approvalNumber);
                            if (periodKey != null && !periodKey.isEmpty())
                                exchange.setProperty("periodKey", periodKey);
                        } catch (Exception e) {
                            log.warn("Could not parse tax-platform response: {}", e.getMessage());
                        }
                    }
                });

        // -----------------------------------------------------------------
        // Tax Platform: GET (find) submission by vpdApprovalNumber + periodKey
        // Mirrors: tax-platform-findSubmission.kamelet.yaml
        //
        // Reads:  exchangeProperty.approvalNumber, exchangeProperty.periodKey
        // Writes: exchangeProperty.taxPlatformResponse (JSON)
        // -----------------------------------------------------------------
        from("direct:tax-platform-findSubmission")
                .routeId("tax-platform-findSubmission")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "GET");
                    exchange.getIn().setHeader("Accept", "application/json");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(null);
                })
                .toD(taxPlatformUrl
                        + "/submissions/vpd?vpdApprovalNumber=${exchangeProperty.approvalNumber}"
                        + "&periodKey=${exchangeProperty.periodKey}"
                        + "&bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    int statusCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
                    String body = exchange.getIn().getBody(String.class);
                    exchange.setProperty("taxPlatformResponseCode", statusCode);
                    exchange.setProperty("taxPlatformResponse", body);
                });

        // -----------------------------------------------------------------
        // Tax Platform: POST store submission
        // Mirrors: tax-platform-storeSubmission.kamelet.yaml
        //
        // Reads:  exchangeProperty.storeRequestBody
        // Writes: exchangeProperty.taxPlatformStoreResponse (JSON)
        // -----------------------------------------------------------------
        from("direct:tax-platform-storeSubmission")
                .routeId("tax-platform-storeSubmission")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "POST");
                    exchange.getIn().setHeader("Content-Type", "application/json");
                    exchange.getIn().setHeader("Accept", "application/json");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setHeader("X-Idempotency-Key",
                            exchange.getProperty("idempotencyKey", String.class));
                    exchange.getIn().setBody(exchange.getProperty("storeRequestBody", String.class));
                })
                .to(taxPlatformUrl + "/submissions/vpd"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    exchange.setProperty("taxPlatformStoreResponse", body);
                });

        // -----------------------------------------------------------------
        // Customer: GET customer by customerId
        // Mirrors: customer-getCustomer.kamelet.yaml
        //
        // Reads:  exchangeProperty.customerId
        // Writes: exchangeProperty.customerResponse (JSON)
        // -----------------------------------------------------------------
        from("direct:customer-getCustomer")
                .routeId("customer-getCustomer")
                .process(exchange -> {
                    exchange.getIn().removeHeaders("*");
                    exchange.getIn().setHeader("CamelHttpMethod", "GET");
                    exchange.getIn().setHeader("Accept", "application/json");
                    exchange.getIn().setHeader("X-Correlation-Id",
                            exchange.getProperty("correlationId", String.class));
                    exchange.getIn().setBody(null);
                })
                .toD(customerUrl + "/customers/${exchangeProperty.customerId}"
                        + "?bridgeEndpoint=true&throwExceptionOnFailure=false")
                .convertBodyTo(String.class)
                .process(exchange -> {
                    String body = exchange.getIn().getBody(String.class);
                    exchange.setProperty("customerResponse", body);
                });
    }
}
