import groovy.json.JsonSlurper
import org.junit.jupiter.api.Test
import static org.junit.jupiter.api.Assertions.*

class SubmissionReturnResponseBuilderTest {

    def slurper = new JsonSlurper()

    @Test
    void 'buildGetResponse combines all backend responses'() {
        def exchange = new MockExchange()
        exchange.setProperty('taxPlatformResponse', '{"acknowledgementReference": "ACK123", "status": "SUBMITTED"}')
        exchange.setProperty('customerResponse', '{"name": "Acme Corp", "type": "COMPANY", "registeredAddress": {"line1": "123 Main St"}}')
        exchange.setProperty('exciseRegistrationResponse', '{"status": "ACTIVE", "registeredDate": "2024-01-01"}')
        exchange.setProperty('excisePeriodResponse', '{"startDate": "2024-01-01", "endDate": "2024-03-31", "state": "OPEN", "dutyRates": {"standardRate": "0.25"}}')

        def result = SubmissionReturnResponseBuilder.buildGetResponse(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('ACK123', parsed.acknowledgementReference)
        assertEquals('SUBMITTED', parsed.status)
        assertEquals('Acme Corp', parsed.trader.name)
        assertEquals('COMPANY', parsed.trader.type)
        assertEquals('ACTIVE', parsed.registration.status)
        assertEquals('OPEN', parsed.period.state)
    }

    @Test
    void 'buildGetResponse handles missing backend responses gracefully'() {
        def exchange = new MockExchange()
        exchange.setProperty('taxPlatformResponse', '{"acknowledgementReference": "ACK123"}')
        // No customer, registration, or period responses

        def result = SubmissionReturnResponseBuilder.buildGetResponse(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('ACK123', parsed.acknowledgementReference)
        assertNull(parsed.trader)
        assertNull(parsed.registration)
        assertNull(parsed.period)
    }

    @Test
    void 'buildGetResponse handles byte array responses'() {
        def exchange = new MockExchange()
        exchange.setProperty('taxPlatformResponse', '{"acknowledgementReference": "ACK123"}'.getBytes('UTF-8'))

        def result = SubmissionReturnResponseBuilder.buildGetResponse(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('ACK123', parsed.acknowledgementReference)
    }

    @Test
    void 'buildPostResponse builds acknowledgement with enriched data'() {
        def exchange = new MockExchange()
        exchange.setProperty('vpdApprovalNumber', 'VPD001')
        exchange.setProperty('periodKey', '24C1')
        exchange.setProperty('taxPlatformStoreResponse', '{"acknowledgementReference": "ACK-2024-001", "storedAt": "2024-01-15T10:00:00Z"}')
        exchange.setProperty('customerResponse', '{"name": "Test Company", "type": "LIMITED"}')
        exchange.setProperty('exciseValidationResponse', '{"calculations": {"totalDutyDue": {"amount": "1000"}}, "warnings": []}')

        def result = SubmissionReturnResponseBuilder.buildPostResponse(exchange)
        def parsed = slurper.parseText(result)

        assertEquals('ACK-2024-001', parsed.acknowledgementReference)
        assertEquals('VPD001', parsed.vpdApprovalNumber)
        assertEquals('24C1', parsed.periodKey)
        assertEquals('RECEIVED', parsed.status)
        assertEquals('Test Company', parsed.trader.name)
        assertNotNull(parsed.calculations)
        assertEquals([], parsed.warnings)
    }
}
