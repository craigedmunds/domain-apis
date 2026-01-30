import groovy.json.JsonSlurper
import groovy.json.JsonOutput

/**
 * Builds the request body for storing submissions in tax-platform.
 */
class StoreRequestBuilder {

    /**
     * Build a store request combining original submission with excise validation.
     *
     * @param exchange The Camel exchange with requestBody and exciseValidationResponse
     * @return JSON string for tax-platform store API
     */
    static String build(exchange) {
        def slurper = new JsonSlurper()

        def originalRequest = slurper.parseText(
            exchange.getProperty('requestBody', String)
        )
        def validation = slurper.parseText(
            exchange.getProperty('exciseValidationResponse', String)
        )

        def storeRequest = [
            vpdApprovalNumber: originalRequest.vpdApprovalNumber,
            periodKey: originalRequest.periodKey,
            customerId: validation.customerId,
            submission: originalRequest,
            calculations: validation.calculations,
            warnings: validation.warnings ?: []
        ]

        return JsonOutput.toJson(storeRequest)
    }
}
