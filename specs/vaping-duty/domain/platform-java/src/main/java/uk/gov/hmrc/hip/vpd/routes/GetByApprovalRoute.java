package uk.gov.hmrc.hip.vpd.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * GET Submission Return by VPD Approval Number + Period Key.
 *
 * <p>Java DSL equivalent of {@code get-submission-return-by-approval.yaml}.
 *
 * <p>Flow:
 * <ol>
 *   <li>excise: get registration (XML→JSON, extracts customerId)</li>
 *   <li>excise: get period (XML→JSON)</li>
 *   <li>tax-platform: find submission by approval+period</li>
 *   <li>customer: get trader details</li>
 *   <li>assemble enriched response</li>
 *   <li>apply sparse fieldsets (if requested)</li>
 *   <li>inject response headers</li>
 * </ol>
 */
@ApplicationScoped
public class GetByApprovalRoute extends RouteBuilder {

    @Override
    public void configure() {

        from("direct:getSubmissionReturnByApproval")
                .routeId("getSubmissionReturnByApproval")

                // Step 1: Get registration from excise (XML→JSON, extracts customerId)
                .to("direct:excise-getRegistration")
                .log("Excise registration received - customerId=${exchangeProperty.customerId}")

                // Step 2: Get period from excise (XML→JSON)
                .to("direct:excise-getPeriod")
                .log("Excise period received")

                // Step 3: Find submission from tax-platform
                .to("direct:tax-platform-findSubmission")
                .log("Tax-platform response - status=${exchangeProperty.taxPlatformResponseCode}")

                // Short-circuit on tax-platform error (e.g. 404 not found)
                .choice()
                    .when(exchangeProperty("taxPlatformResponseCode").isGreaterThanOrEqualTo(400))
                        .setHeader("CamelHttpResponseCode", exchangeProperty("taxPlatformResponseCode"))
                        .setBody(exchangeProperty("taxPlatformResponse"))
                        .to("direct:injectResponseHeaders")
                        .stop()
                .end()

                // Step 4: Get customer details
                .to("direct:customer-getCustomer")
                .log("Customer response received")

                // Step 5: Combine all responses into enriched response
                .to("direct:assembleSubmissionReturnResponse")

                // Step 6: Apply sparse fieldsets if requested
                .to("direct:applySparseFieldsets")

                // Inject standard response headers
                .to("direct:injectResponseHeaders");
    }
}
