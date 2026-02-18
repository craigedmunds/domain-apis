package uk.gov.hmrc.hip.vpd.routes;

import jakarta.enterprise.context.ApplicationScoped;
import org.apache.camel.builder.RouteBuilder;

/**
 * GET Submission Return by Acknowledgement Reference.
 *
 * <p>Java DSL equivalent of {@code get-submission-return-by-ack.yaml}.
 *
 * <p>Flow:
 * <ol>
 *   <li>tax-platform: get submission (extracts customerId, approvalNumber, periodKey)</li>
 *   <li>excise: get registration (XML→JSON)</li>
 *   <li>excise: get period (XML→JSON)</li>
 *   <li>customer: get trader details</li>
 *   <li>assemble enriched response</li>
 *   <li>apply sparse fieldsets (if requested)</li>
 *   <li>inject response headers</li>
 * </ol>
 */
@ApplicationScoped
public class GetByAckRoute extends RouteBuilder {

    @Override
    public void configure() {

        from("direct:getSubmissionReturnByAck")
                .routeId("getSubmissionReturnByAck")

                // Step 1: Get submission from tax-platform
                // (also extracts customerId, vpdApprovalNumber, periodKey into properties)
                .to("direct:tax-platform-getSubmission")
                .log("Tax-platform response - customerId=${exchangeProperty.customerId}, "
                        + "approval=${exchangeProperty.vpdApprovalNumber}, "
                        + "period=${exchangeProperty.periodKey}")

                // Step 2: Get registration from excise (XML→JSON)
                .to("direct:excise-getRegistration")
                .log("Excise registration received")

                // Step 3: Get period from excise (XML→JSON)
                .to("direct:excise-getPeriod")
                .log("Excise period received")

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
