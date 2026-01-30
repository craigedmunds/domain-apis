import groovy.json.JsonSlurper
import groovy.json.JsonOutput

/**
 * Builds submission return responses by combining data from multiple backends.
 */
class SubmissionReturnResponseBuilder {

    /**
     * Build GET response combining tax-platform, customer, excise registration and period data.
     *
     * @param exchange The Camel exchange with backend response properties
     * @return JSON string with enriched submission return
     */
    static String buildGetResponse(exchange) {
        def slurper = new JsonSlurper()

        // Parse all backend responses
        def submission = parseProperty(slurper, exchange, 'taxPlatformResponse') ?: [:]
        def customer = parseProperty(slurper, exchange, 'customerResponse') ?: [:]
        def registration = parseProperty(slurper, exchange, 'exciseRegistrationResponse') ?: [:]
        def period = parseProperty(slurper, exchange, 'excisePeriodResponse') ?: [:]

        // Enrich with trader from customer data
        if (customer) {
            submission.trader = [
                name: customer.name,
                type: customer.type,
                address: customer.registeredAddress
            ]
        }

        // Enrich with registration details from excise
        if (registration) {
            submission.registration = [
                status: registration.status,
                registeredDate: registration.registeredDate
            ]
        }

        // Enrich with period details from excise
        if (period) {
            submission.period = [
                startDate: period.startDate,
                endDate: period.endDate,
                state: period.state,
                dutyRates: period.dutyRates
            ]
        }

        return JsonOutput.toJson(submission)
    }

    /**
     * Build POST response with acknowledgement and enriched data.
     *
     * @param exchange The Camel exchange with backend response properties
     * @return JSON string with acknowledgement response
     */
    static String buildPostResponse(exchange) {
        def slurper = new JsonSlurper()

        def storeResult = parseProperty(slurper, exchange, 'taxPlatformStoreResponse') ?: [:]
        def customer = parseProperty(slurper, exchange, 'customerResponse') ?: [:]
        def validation = parseProperty(slurper, exchange, 'exciseValidationResponse') ?: [:]

        def response = [
            acknowledgementReference: storeResult.acknowledgementReference,
            vpdApprovalNumber: exchange.getProperty('vpdApprovalNumber'),
            periodKey: exchange.getProperty('periodKey'),
            status: 'RECEIVED',
            storedAt: storeResult.storedAt,
            trader: [
                name: customer.name,
                type: customer.type
            ],
            calculations: validation.calculations,
            warnings: validation.warnings ?: []
        ]

        return JsonOutput.toJson(response)
    }

    private static Map parseProperty(slurper, exchange, String propertyName) {
        def value = exchange.getProperty(propertyName)
        if (!value) {
            return null
        }

        // Handle byte arrays
        if (value instanceof byte[]) {
            value = new String(value, 'UTF-8')
        }

        try {
            return slurper.parseText(value.toString())
        } catch (Exception e) {
            return null
        }
    }
}
