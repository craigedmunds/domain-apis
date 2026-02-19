package uk.gov.hmrc.hip.vpd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ResponseBuilderTest {

    private ResponseBuilder builder;
    private ObjectMapper mapper;

    // Representative fixture payloads matching what the mocks return
    private static final String TAX_PLATFORM_JSON = """
            {
              "acknowledgementReference": "ACK-2026-01-26-000123",
              "vpdApprovalNumber": "VPD123456",
              "periodKey": "24A1",
              "customerId": "CUST789",
              "submission": {
                "basicInformation": {"returnType": "ORIGINAL", "submittedBy": {"type": "ORG", "name": "Example Vapes Ltd"}},
                "dutyProducts": []
              },
              "calculations": {"totalDutyDue": {"amount": 12345.67, "currency": "GBP"}, "vat": {"amount": 2469.13, "currency": "GBP"}, "calculationHash": "sha256:abc123"},
              "warnings": [],
              "submittedAt": "2026-01-26T14:51:02Z",
              "status": "RECEIVED"
            }
            """;

    private static final String CUSTOMER_JSON = """
            {
              "customerId": "CUST789",
              "name": "Example Vapes Ltd",
              "type": "ORG",
              "registeredAddress": {"line1": "1 Example Street", "city": "London", "postcode": "SW1A 1AA"}
            }
            """;

    private static final String REGISTRATION_JSON = """
            {"vpdApprovalNumber": "VPD123456", "customerId": "CUST789", "status": "ACTIVE", "registeredDate": "2023-06-15"}
            """;

    private static final String PERIOD_JSON = """
            {"periodKey": "24A1", "startDate": "2024-01-01", "endDate": "2024-03-31", "state": "OPEN", "dutyRates": "0.15"}
            """;

    @BeforeEach
    void setUp() {
        builder = new ResponseBuilder();
        mapper = new ObjectMapper();
    }

    // -------------------------------------------------------------------------
    // assembleGetResponse
    // -------------------------------------------------------------------------

    @Test
    void assembleGetResponse_includesAllBackendData() throws Exception {
        String json = builder.assembleGetResponse(TAX_PLATFORM_JSON, CUSTOMER_JSON, REGISTRATION_JSON, PERIOD_JSON);
        JsonNode node = mapper.readTree(json);

        // Tax-platform fields preserved
        assertEquals("ACK-2026-01-26-000123", node.path("acknowledgementReference").asText());
        assertEquals("VPD123456", node.path("vpdApprovalNumber").asText());
        assertEquals("24A1", node.path("periodKey").asText());
        assertEquals("RECEIVED", node.path("status").asText());

        // Trader enriched from customer service
        assertEquals("Example Vapes Ltd", node.path("trader").path("name").asText());
        assertEquals("ORG", node.path("trader").path("type").asText());
        assertEquals("1 Example Street", node.path("trader").path("address").path("line1").asText());

        // Registration enriched from excise
        assertEquals("ACTIVE", node.path("registration").path("status").asText());
        assertEquals("2023-06-15", node.path("registration").path("registeredDate").asText());

        // Period enriched from excise
        assertEquals("2024-01-01", node.path("period").path("startDate").asText());
        assertEquals("2024-03-31", node.path("period").path("endDate").asText());
        assertEquals("OPEN", node.path("period").path("state").asText());
    }

    @Test
    void assembleGetResponse_nullCustomer_omitsTrader() throws Exception {
        String json = builder.assembleGetResponse(TAX_PLATFORM_JSON, null, REGISTRATION_JSON, PERIOD_JSON);
        JsonNode node = mapper.readTree(json);

        assertTrue(node.path("trader").isMissingNode(), "trader should be absent when customer is null");
    }

    @Test
    void assembleGetResponse_nullRegistration_omitsRegistration() throws Exception {
        String json = builder.assembleGetResponse(TAX_PLATFORM_JSON, CUSTOMER_JSON, null, PERIOD_JSON);
        JsonNode node = mapper.readTree(json);

        assertTrue(node.path("registration").isMissingNode());
    }

    @Test
    void assembleGetResponse_nullPeriod_omitsPeriod() throws Exception {
        String json = builder.assembleGetResponse(TAX_PLATFORM_JSON, CUSTOMER_JSON, REGISTRATION_JSON, null);
        JsonNode node = mapper.readTree(json);

        assertTrue(node.path("period").isMissingNode());
    }

    @Test
    void assembleGetResponse_emptyTaxPlatform_returnsEmptyObject() throws Exception {
        String json = builder.assembleGetResponse(null, null, null, null);
        JsonNode node = mapper.readTree(json);

        assertTrue(node.isObject());
        assertEquals(0, node.size());
    }

    // -------------------------------------------------------------------------
    // assemblePostResponse
    // -------------------------------------------------------------------------

    @Test
    void assemblePostResponse_includesAllFields() throws Exception {
        String storeJson = """
                {"acknowledgementReference": "ACK-NEW-001", "storedAt": "2026-01-26T15:00:00Z"}
                """;
        String validationJson = """
                {"valid": true, "customerId": "CUST789",
                 "calculations": {"totalDutyDue": {"amount": 100.0, "currency": "GBP"}},
                 "warnings": []}
                """;

        String json = builder.assemblePostResponse(storeJson, CUSTOMER_JSON, validationJson, "VPD123456", "24A1");
        JsonNode node = mapper.readTree(json);

        assertEquals("ACK-NEW-001", node.path("acknowledgementReference").asText());
        assertEquals("VPD123456", node.path("vpdApprovalNumber").asText());
        assertEquals("24A1", node.path("periodKey").asText());
        assertEquals("RECEIVED", node.path("status").asText());
        assertEquals("Example Vapes Ltd", node.path("trader").path("name").asText());
        assertEquals("ORG", node.path("trader").path("type").asText());
        assertFalse(node.path("calculations").isMissingNode());
        assertTrue(node.path("warnings").isArray());
    }

    // -------------------------------------------------------------------------
    // buildStoreRequest
    // -------------------------------------------------------------------------

    @Test
    void buildStoreRequest_structuresCorrectly() throws Exception {
        String originalJson = """
                {"vpdApprovalNumber": "VPD123456", "periodKey": "24A1",
                 "basicInformation": {"returnType": "ORIGINAL"}, "dutyProducts": []}
                """;
        String validationJson = """
                {"valid": true, "customerId": "CUST789",
                 "calculations": {"totalDutyDue": {"amount": 500.0}}, "warnings": []}
                """;

        String json = builder.buildStoreRequest(originalJson, validationJson);
        JsonNode node = mapper.readTree(json);

        assertEquals("VPD123456", node.path("vpdApprovalNumber").asText());
        assertEquals("24A1", node.path("periodKey").asText());
        assertEquals("CUST789", node.path("customerId").asText());
        assertFalse(node.path("submission").isMissingNode());
        assertFalse(node.path("calculations").isMissingNode());
        assertTrue(node.path("warnings").isArray());
    }

    // -------------------------------------------------------------------------
    // buildValidationErrorResponse
    // -------------------------------------------------------------------------

    @Test
    void buildValidationErrorResponse_setsCorrectCode() throws Exception {
        String validationJson = """
                {"valid": false, "warnings": [{"code": "WARN-001", "text": "Bad value"}]}
                """;

        String json = builder.buildValidationErrorResponse(validationJson);
        JsonNode node = mapper.readTree(json);

        assertEquals("VALIDATION_FAILED", node.path("code").asText());
        assertEquals("Submission failed validation", node.path("message").asText());
        assertEquals(1, node.path("warnings").size());
        assertEquals("WARN-001", node.path("warnings").get(0).path("code").asText());
    }

    // -------------------------------------------------------------------------
    // applySparseFieldsets
    // -------------------------------------------------------------------------

    @Test
    void applySparseFieldsets_noFilter_returnsFullResponse() throws Exception {
        ResponseBuilder.SparseResult result = builder.applySparseFieldsets(TAX_PLATFORM_JSON, null);

        assertFalse(result.hasError());
        JsonNode node = mapper.readTree(result.json());
        assertEquals("ACK-2026-01-26-000123", node.path("acknowledgementReference").asText());
    }

    @Test
    void applySparseFieldsets_topLevelFields_filtersCorrectly() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "acknowledgementReference,customerId");

        assertFalse(result.hasError());
        JsonNode node = mapper.readTree(result.json());

        assertEquals("ACK-2026-01-26-000123", node.path("acknowledgementReference").asText());
        assertEquals("CUST789", node.path("customerId").asText());
        assertEquals(2, node.size(), "should contain exactly 2 fields");
        assertTrue(node.path("vpdApprovalNumber").isMissingNode());
        assertTrue(node.path("status").isMissingNode());
    }

    @Test
    void applySparseFieldsets_singleField() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "acknowledgementReference");

        assertFalse(result.hasError());
        JsonNode node = mapper.readTree(result.json());
        assertEquals(1, node.size());
        assertEquals("ACK-2026-01-26-000123", node.path("acknowledgementReference").asText());
    }

    @Test
    void applySparseFieldsets_nestedField_reconstructsPath() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "submission.basicInformation");

        assertFalse(result.hasError());
        JsonNode node = mapper.readTree(result.json());

        assertEquals(1, node.size(), "only 'submission' at top level");
        assertFalse(node.path("submission").path("basicInformation").isMissingNode());
        assertTrue(node.path("submission").path("dutyProducts").isMissingNode(),
                "dutyProducts not requested, should be absent");
    }

    @Test
    void applySparseFieldsets_invalidField_returnsError() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "invalidField,anotherBadField");

        assertTrue(result.hasError());
        assertTrue(result.invalidFields().contains("invalidField"));
        assertTrue(result.invalidFields().contains("anotherBadField"));
    }

    @Test
    void applySparseFieldsets_mixedValidAndInvalid_returnsError() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "acknowledgementReference,invalidField");

        assertTrue(result.hasError());
        assertTrue(result.invalidFields().contains("invalidField"));
        assertFalse(result.invalidFields().contains("acknowledgementReference"));
    }

    @Test
    void applySparseFieldsets_whitespaceInList_trimsCorrectly() throws Exception {
        ResponseBuilder.SparseResult result =
                builder.applySparseFieldsets(TAX_PLATFORM_JSON, "acknowledgementReference, customerId, vpdApprovalNumber");

        assertFalse(result.hasError());
        JsonNode node = mapper.readTree(result.json());
        assertEquals(3, node.size());
    }

    @Test
    void applySparseFieldsets_emptyParam_returnsFullResponse() throws Exception {
        ResponseBuilder.SparseResult result = builder.applySparseFieldsets(TAX_PLATFORM_JSON, "");

        assertFalse(result.hasError());
        // Full response unchanged
        JsonNode node = mapper.readTree(result.json());
        assertFalse(node.path("acknowledgementReference").isMissingNode());
    }
}
