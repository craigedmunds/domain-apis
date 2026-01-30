import groovy.json.JsonSlurper
import groovy.json.JsonOutput

/**
 * Builds validation error responses for submission returns.
 */
class ValidationErrorBuilder {

    /**
     * Build a validation error response from excise validation result.
     *
     * @param exchange The Camel exchange with exciseValidationResponse property
     * @return JSON string with error details
     */
    static String build(exchange) {
        def slurper = new JsonSlurper()
        def validation = slurper.parseText(
            exchange.getProperty('exciseValidationResponse', String)
        )

        def error = [
            code: 'VALIDATION_FAILED',
            message: 'Submission failed validation',
            warnings: validation.warnings ?: []
        ]

        return JsonOutput.toJson(error)
    }
}
