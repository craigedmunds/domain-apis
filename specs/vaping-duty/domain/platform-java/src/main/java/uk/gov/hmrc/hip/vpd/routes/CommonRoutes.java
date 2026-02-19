package uk.gov.hmrc.hip.vpd.routes;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;
import uk.gov.hmrc.hip.vpd.service.ResponseBuilder;

/**
 * Common/shared routes used across all orchestration flows.
 *
 * <p>Java DSL equivalent of {@code common.yaml}. Routes here are called
 * via {@code to("direct:...")} from the main orchestration routes.
 *
 * <p>Routes provided:
 * <ul>
 *   <li>extractStandardHeaders  - stores correlationId and idempotencyKey</li>
 *   <li>injectResponseHeaders   - sets Content-Type and X-Correlation-Id on response</li>
 *   <li>assembleSubmissionReturnResponse - merges 4 backend responses</li>
 *   <li>applySparseFieldsets    - filters response fields</li>
 *   <li>health                  - returns {"status": "UP"}</li>
 * </ul>
 */
@ApplicationScoped
public class CommonRoutes extends RouteBuilder {

    @Inject
    ResponseBuilder responseBuilder;

    @Override
    public void configure() {

        // -----------------------------------------------------------------
        // extractStandardHeaders
        // Mirrors: common.yaml#extractStandardHeaders
        // -----------------------------------------------------------------
        from("direct:extractStandardHeaders")
                .routeId("extractStandardHeaders")
                .setProperty("correlationId", header("X-Correlation-Id"))
                .setProperty("idempotencyKey", header("X-Idempotency-Key"))
                .log("Request correlationId=${exchangeProperty.correlationId}");

        // -----------------------------------------------------------------
        // injectResponseHeaders
        // Mirrors: common.yaml#injectResponseHeaders
        // -----------------------------------------------------------------
        from("direct:injectResponseHeaders")
                .routeId("injectResponseHeaders")
                .setHeader("Content-Type", constant("application/json"))
                .setHeader("X-Correlation-Id", exchangeProperty("correlationId"))
                .removeHeader("fields[submission-returns]")
                .removeHeader("CamelHttpQuery");

        // -----------------------------------------------------------------
        // assembleSubmissionReturnResponse
        // Mirrors: common.yaml#assembleSubmissionReturnResponse
        //
        // Uses ResponseBuilder service (fully unit-testable, unlike inline Groovy).
        // -----------------------------------------------------------------
        from("direct:assembleSubmissionReturnResponse")
                .routeId("assembleSubmissionReturnResponse")
                .process(exchange -> {
                    String taxPlatformJson = exchange.getProperty("taxPlatformResponse", String.class);
                    String customerJson    = exchange.getProperty("customerResponse", String.class);
                    String registrationJson = exchange.getProperty("exciseRegistrationResponse", String.class);
                    String periodJson      = exchange.getProperty("excisePeriodResponse", String.class);

                    String assembled = responseBuilder.assembleGetResponse(
                            taxPlatformJson, customerJson, registrationJson, periodJson);
                    exchange.getIn().setBody(assembled);
                });

        // -----------------------------------------------------------------
        // applySparseFieldsets
        // Mirrors: common.yaml#applySparseFieldsets
        // -----------------------------------------------------------------
        from("direct:applySparseFieldsets")
                .routeId("applySparseFieldsets")
                .process(exchange -> {
                    String fieldsParam = exchange.getProperty("fieldsParam", String.class);
                    if (fieldsParam == null || fieldsParam.isBlank()) {
                        return; // No filtering requested
                    }

                    String body = exchange.getIn().getBody(String.class);
                    ResponseBuilder.SparseResult result = responseBuilder.applySparseFieldsets(body, fieldsParam);

                    if (result.hasError()) {
                        exchange.setProperty("sparseFieldsetError", true);
                        exchange.setProperty("invalidFields", result.invalidFields());
                    } else {
                        exchange.getIn().setBody(result.json());
                    }
                })
                // Handle sparse fieldset validation errors
                .choice()
                    .when(exchangeProperty("sparseFieldsetError").isEqualTo(true))
                        .setHeader("CamelHttpResponseCode", constant(400))
                        .setBody(simple(
                                "{\"code\": \"INVALID_FIELDS\", \"message\": " +
                                "\"Unknown fields requested: ${exchangeProperty.invalidFields}\"}"))
                        .setHeader("Content-Type", constant("application/json"))
                        .stop()
                .end();

        // -----------------------------------------------------------------
        // health
        // Mirrors: common.yaml#health
        // -----------------------------------------------------------------
        from("direct:health")
                .routeId("health")
                .setHeader("Content-Type", constant("application/json"))
                .setBody(constant("{\"status\": \"UP\"}"));
    }
}
