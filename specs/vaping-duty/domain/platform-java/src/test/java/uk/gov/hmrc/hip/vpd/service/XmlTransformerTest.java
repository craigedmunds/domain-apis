package uk.gov.hmrc.hip.vpd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class XmlTransformerTest {

    private XmlTransformer transformer;
    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        transformer = new XmlTransformer();
        mapper = new ObjectMapper();
    }

    // -------------------------------------------------------------------------
    // registrationXmlToJson
    // -------------------------------------------------------------------------

    @Test
    void registrationXmlToJson_extractsAllFields() throws Exception {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <registration>
                  <vpdApprovalNumber>VPD123456</vpdApprovalNumber>
                  <customerId>CUST789</customerId>
                  <status>ACTIVE</status>
                  <registeredDate>2023-06-15</registeredDate>
                </registration>
                """;

        String json = transformer.registrationXmlToJson(xml);
        JsonNode node = mapper.readTree(json);

        assertEquals("VPD123456", node.path("vpdApprovalNumber").asText());
        assertEquals("CUST789",   node.path("customerId").asText());
        assertEquals("ACTIVE",    node.path("status").asText());
        assertEquals("2023-06-15", node.path("registeredDate").asText());
    }

    @Test
    void registrationXmlToJson_handlesAllStatusValues() throws Exception {
        for (String status : new String[]{"ACTIVE", "SUSPENDED", "DEREGISTERED"}) {
            String xml = "<registration><vpdApprovalNumber>V</vpdApprovalNumber>"
                    + "<customerId>C</customerId><status>" + status + "</status>"
                    + "<registeredDate>2024-01-01</registeredDate></registration>";
            String json = transformer.registrationXmlToJson(xml);
            assertEquals(status, mapper.readTree(json).path("status").asText());
        }
    }

    @Test
    void extractCustomerIdFromRegistration_returnsCustomerId() throws Exception {
        String xml = """
                <registration>
                  <vpdApprovalNumber>VPD123456</vpdApprovalNumber>
                  <customerId>CUST999</customerId>
                  <status>ACTIVE</status>
                  <registeredDate>2023-06-15</registeredDate>
                </registration>
                """;

        String customerId = transformer.extractCustomerIdFromRegistration(xml);
        assertEquals("CUST999", customerId);
    }

    // -------------------------------------------------------------------------
    // periodXmlToJson
    // -------------------------------------------------------------------------

    @Test
    void periodXmlToJson_extractsAllFields() throws Exception {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <period>
                  <periodKey>24A1</periodKey>
                  <startDate>2024-01-01</startDate>
                  <endDate>2024-03-31</endDate>
                  <state>OPEN</state>
                  <dutyRates>
                    <standardRate>0.15</standardRate>
                    <reducedRate>0.075</reducedRate>
                  </dutyRates>
                </period>
                """;

        String json = transformer.periodXmlToJson(xml);
        JsonNode node = mapper.readTree(json);

        assertEquals("24A1",       node.path("periodKey").asText());
        assertEquals("2024-01-01", node.path("startDate").asText());
        assertEquals("2024-03-31", node.path("endDate").asText());
        assertEquals("OPEN",       node.path("state").asText());
        assertFalse(node.path("dutyRates").isMissingNode(), "dutyRates should be present");
    }

    @Test
    void periodXmlToJson_handlesAllStateValues() throws Exception {
        for (String state : new String[]{"OPEN", "FILED", "CLOSED"}) {
            String xml = "<period><periodKey>P</periodKey><startDate>2024-01-01</startDate>"
                    + "<endDate>2024-03-31</endDate><state>" + state + "</state></period>";
            String json = transformer.periodXmlToJson(xml);
            assertEquals(state, mapper.readTree(json).path("state").asText());
        }
    }

    // -------------------------------------------------------------------------
    // validateAndCalculateXmlToJson
    // -------------------------------------------------------------------------

    @Test
    void validateAndCalculate_validSubmission() throws Exception {
        String xml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <validation>
                  <valid>true</valid>
                  <customerId>CUST789</customerId>
                  <calculations>
                    <totalDutyDue currency="GBP">12345.67</totalDutyDue>
                    <vat>2469.13</vat>
                    <calculationHash>sha256:abc123</calculationHash>
                  </calculations>
                  <warnings/>
                </validation>
                """;

        XmlTransformer.ValidationResult result = transformer.validateAndCalculateXmlToJson(xml);

        assertTrue(result.valid());
        assertEquals("CUST789", result.customerId());

        JsonNode node = mapper.readTree(result.json());
        assertTrue(node.path("valid").asBoolean());
        assertEquals("CUST789", node.path("customerId").asText());
        assertEquals(12345.67,  node.path("calculations").path("totalDutyDue").path("amount").asDouble(), 0.001);
        assertEquals("GBP",     node.path("calculations").path("totalDutyDue").path("currency").asText());
        assertEquals(2469.13,   node.path("calculations").path("vat").path("amount").asDouble(), 0.001);
        assertEquals("sha256:abc123", node.path("calculations").path("calculationHash").asText());
        assertTrue(node.path("warnings").isArray());
        assertEquals(0, node.path("warnings").size());
    }

    @Test
    void validateAndCalculate_invalidSubmissionWithWarnings() throws Exception {
        String xml = """
                <validation>
                  <valid>false</valid>
                  <customerId>CUST789</customerId>
                  <calculations>
                    <totalDutyDue currency="GBP">0</totalDutyDue>
                    <vat>0</vat>
                    <calculationHash></calculationHash>
                  </calculations>
                  <warnings>
                    <warning code="WARN-VD-001">Spoilt product close to upper threshold</warning>
                    <warning code="WARN-VD-002">Rate band mismatch</warning>
                  </warnings>
                </validation>
                """;

        XmlTransformer.ValidationResult result = transformer.validateAndCalculateXmlToJson(xml);

        assertFalse(result.valid());

        JsonNode node = mapper.readTree(result.json());
        assertFalse(node.path("valid").asBoolean());
        assertEquals(2, node.path("warnings").size());
        assertEquals("WARN-VD-001", node.path("warnings").get(0).path("code").asText());
        assertEquals("Spoilt product close to upper threshold",
                node.path("warnings").get(0).path("text").asText());
        assertEquals("WARN-VD-002", node.path("warnings").get(1).path("code").asText());
    }

    @Test
    void validateAndCalculate_missingAmount_defaultsToZero() throws Exception {
        String xml = """
                <validation>
                  <valid>true</valid>
                  <customerId>CUST1</customerId>
                  <calculations>
                    <totalDutyDue currency="GBP"></totalDutyDue>
                    <vat></vat>
                    <calculationHash>hash</calculationHash>
                  </calculations>
                  <warnings/>
                </validation>
                """;

        XmlTransformer.ValidationResult result = transformer.validateAndCalculateXmlToJson(xml);
        JsonNode node = mapper.readTree(result.json());

        assertEquals(0.0, node.path("calculations").path("totalDutyDue").path("amount").asDouble(), 0.001);
        assertEquals(0.0, node.path("calculations").path("vat").path("amount").asDouble(), 0.001);
    }
}
