import groovy.json.JsonSlurper
import org.junit.jupiter.api.Test
import static org.junit.jupiter.api.Assertions.*

class ValidationErrorBuilderTest {

    def slurper = new JsonSlurper()

    @Test
    void 'build creates validation error response'() {
        def exchange = new MockExchange()
        exchange.setProperty('exciseValidationResponse', '{"warnings": [{"code": "W001", "text": "Warning message"}]}')

        def result = ValidationErrorBuilder.build(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('VALIDATION_FAILED', parsed.code)
        assertEquals('Submission failed validation', parsed.message)
        assertEquals(1, parsed.warnings.size())
        assertEquals('W001', parsed.warnings[0].code)
    }

    @Test
    void 'build handles empty warnings'() {
        def exchange = new MockExchange()
        exchange.setProperty('exciseValidationResponse', '{"warnings": []}')

        def result = ValidationErrorBuilder.build(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('VALIDATION_FAILED', parsed.code)
        assertEquals([], parsed.warnings)
    }

    @Test
    void 'build handles missing warnings field'() {
        def exchange = new MockExchange()
        exchange.setProperty('exciseValidationResponse', '{}')

        def result = ValidationErrorBuilder.build(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('VALIDATION_FAILED', parsed.code)
        assertEquals([], parsed.warnings)
    }
}
