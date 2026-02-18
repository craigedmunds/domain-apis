package uk.gov.hmrc.hip.vpd.routes;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.apache.camel.builder.RouteBuilder;
import uk.gov.hmrc.hip.vpd.service.ResponseBuilder;

/**
 * POST Submission Return orchestration route.
 *
 * <p>Java DSL equivalent of {@code post-submission-return.yaml}.
 *
 * <p>Flow:
 * <ol>
 *   <li>Extract standard headers (correlationId, idempotencyKey)</li>
 *   <li>Store request body for reuse</li>
 *   <li>Extract vpdApprovalNumber and periodKey from body</li>
 *   <li>excise: validate-and-calculate (JSON → XML response → JSON)</li>
 *   <li>Check excise response code; short-circuit on error</li>
 *   <li>Check validation result; return 422 with errors if invalid</li>
 *   <li>Build store request body (merge original request + validation result)</li>
 *   <li>tax-platform: store submission</li>
 *   <li>customer: get customer details</li>
 *   <li>Build 201 response (acknowledgement + trader + calculations)</li>
 *   <li>Inject response headers</li>
 * </ol>
 */
@ApplicationScoped
public class PostSubmissionRoute extends RouteBuilder {

    @Inject
    ResponseBuilder responseBuilder;

    @Override
    public void configure() {

        from("direct:postSubmissionReturn")
                .routeId("postSubmissionReturn")

                // Step 0: Extract standard headers
                .to("direct:extractStandardHeaders")

                // Store request body for reuse (reads InputStream/byte[] safely)
                .process(exchange -> {
                    Object body = exchange.getIn().getBody();
                    String bodyStr;
                    if (body == null) {
                        bodyStr = null;
                    } else if (body instanceof byte[]) {
                        bodyStr = new String((byte[]) body, java.nio.charset.StandardCharsets.UTF_8);
                    } else if (body instanceof java.io.InputStream) {
                        bodyStr = new String(((java.io.InputStream) body).readAllBytes(),
                                java.nio.charset.StandardCharsets.UTF_8);
                    } else {
                        bodyStr = body.toString();
                    }
                    exchange.setProperty("requestBody", bodyStr);
                    exchange.getIn().setBody(bodyStr);
                })

                // Extract vpdApprovalNumber and periodKey from request body
                .setProperty("vpdApprovalNumber",
                        jsonpath("$.vpdApprovalNumber").suppressExceptions())
                .setProperty("periodKey",
                        jsonpath("$.periodKey").suppressExceptions())

                .log("POST submission - approval=${exchangeProperty.vpdApprovalNumber}, "
                        + "period=${exchangeProperty.periodKey}")

                // Step 1: Validate and calculate via excise
                .to("direct:excise-validateAndCalc")

                // Check for excise errors
                .choice()
                    .when(exchangeProperty("exciseResponseCode").isNotEqualTo(200))
                        .log("Excise returned error: ${exchangeProperty.exciseResponseCode}")
                        .setHeader("CamelHttpResponseCode", exchangeProperty("exciseResponseCode"))
                        .setBody(constant(
                                "{\"code\": \"EXCISE_ERROR\", \"message\": " +
                                "\"Excise validation service returned an error\"}"))
                        .to("direct:injectResponseHeaders")
                        .stop()
                .end()

                .log("Excise validation result - valid=${exchangeProperty.validationValid}, "
                        + "customerId=${exchangeProperty.customerId}")

                // Step 2: Check validation result - short-circuit if invalid
                .choice()
                    .when(exchangeProperty("validationValid").isEqualTo(false))
                        .setHeader("CamelHttpResponseCode", constant(422))
                        .process(exchange -> {
                            String validationJson = exchange.getProperty(
                                    "exciseValidationResponse", String.class);
                            exchange.getIn().setBody(
                                    responseBuilder.buildValidationErrorResponse(validationJson));
                        })
                        .to("direct:injectResponseHeaders")
                        .stop()
                .end()

                // Step 3: Build store request and call tax-platform
                .process(exchange -> {
                    String storeBody = responseBuilder.buildStoreRequest(
                            exchange.getProperty("requestBody", String.class),
                            exchange.getProperty("exciseValidationResponse", String.class));
                    exchange.setProperty("storeRequestBody", storeBody);
                })
                .to("direct:tax-platform-storeSubmission")
                .log("Submission stored in tax-platform")

                // Step 4: Get customer details
                .to("direct:customer-getCustomer")
                .log("Customer details retrieved")

                // Step 5: Build enriched 201 response
                .process(exchange -> {
                    String responseJson = responseBuilder.assemblePostResponse(
                            exchange.getProperty("taxPlatformStoreResponse", String.class),
                            exchange.getProperty("customerResponse", String.class),
                            exchange.getProperty("exciseValidationResponse", String.class),
                            exchange.getProperty("vpdApprovalNumber", String.class),
                            exchange.getProperty("periodKey", String.class));
                    exchange.getIn().setBody(responseJson);
                })

                .setHeader("CamelHttpResponseCode", constant(201))
                .to("direct:injectResponseHeaders");
    }
}
