import groovy.json.JsonSlurper
import org.junit.jupiter.api.Test
import static org.junit.jupiter.api.Assertions.*

class StoreRequestBuilderTest {

    def slurper = new JsonSlurper()

    @Test
    void 'build creates store request with all fields'() {
        def exchange = new MockExchange()
        exchange.setProperty('requestBody', '{"vpdApprovalNumber": "VPD001", "periodKey": "24C1", "liabilities": []}')
        exchange.setProperty('exciseValidationResponse', '{"customerId": "CUST123", "calculations": {"totalDutyDue": {"amount": "500"}}, "warnings": [{"code": "W1"}]}')

        def result = StoreRequestBuilder.build(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('VPD001', parsed.vpdApprovalNumber)
        assertEquals('24C1', parsed.periodKey)
        assertEquals('CUST123', parsed.customerId)
        assertNotNull(parsed.submission)
        assertEquals('VPD001', parsed.submission.vpdApprovalNumber)
        assertNotNull(parsed.calculations)
        assertEquals(1, parsed.warnings.size())
    }

    @Test
    void 'build handles empty warnings'() {
        def exchange = new MockExchange()
        exchange.setProperty('requestBody', '{"vpdApprovalNumber": "VPD001", "periodKey": "24C1"}')
        exchange.setProperty('exciseValidationResponse', '{"customerId": "CUST123", "calculations": {}}')

        def result = StoreRequestBuilder.build(exchange)
        def parsed = slurper.parseText(result)

        assertEquals([], parsed.warnings)
    }
}
