package uk.gov.hmrc.hip.cd.processor;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Exchange;
import org.apache.camel.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link GoodsItemValidationProcessor}.
 *
 * Tests cover each validation rule in isolation and the cross-field EXCISE rule.
 */
@ExtendWith(MockitoExtension.class)
class GoodsItemValidationProcessorTest {

    private GoodsItemValidationProcessor processor;
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Mock
    private Exchange exchange;

    @Mock
    private Message message;

    @BeforeEach
    void setUp() {
        processor = new GoodsItemValidationProcessor();
        when(exchange.getIn()).thenReturn(message);
    }

    // =========================================================================
    // Happy path
    // =========================================================================

    @Test
    void validImportItem_passesValidation() throws Exception {
        // Given: a fully valid IMPORT goods item
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 100.0,
                  "netMass": 500.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);
        when(exchange.getProperty("CamelSplitIndex", Integer.class)).thenReturn(0);

        // When
        processor.process(exchange);

        // Then: no failure indicators set
        verify(exchange, never()).setRouteStop(anyBoolean());
        verify(message, never()).setHeader(eq("CamelHttpResponseCode"), anyInt());
        verify(message).setHeader("itemCommodityCode", "2203000100");
    }

    @Test
    void validExportItem_passesValidation() throws Exception {
        String json = """
                {
                  "commodityCode": "3304990000",
                  "quantity": 50.0,
                  "dutyType": "EXPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);
        when(exchange.getProperty("CamelSplitIndex", Integer.class)).thenReturn(1);

        processor.process(exchange);

        verify(exchange, never()).setRouteStop(anyBoolean());
    }

    @Test
    void validExciseItemWithExciseProductCode_passesValidation() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 200.0,
                  "dutyType": "EXCISE",
                  "exciseProductCode": "B000"
                }
                """;
        when(message.getBody()).thenReturn(json);
        when(exchange.getProperty("CamelSplitIndex", Integer.class)).thenReturn(0);

        processor.process(exchange);

        verify(exchange, never()).setRouteStop(anyBoolean());
    }

    // =========================================================================
    // Rule 1: commodityCode must be 10-digit numeric
    // =========================================================================

    @Test
    void invalidCommodityCode_notTenDigits_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "12345",
                  "quantity": 10.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    @Test
    void invalidCommodityCode_nonNumeric_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "ABCD123456",
                  "quantity": 10.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    @Test
    void missingCommodityCode_returns422() throws Exception {
        String json = """
                {
                  "quantity": 10.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    // =========================================================================
    // Rule 2: quantity must be positive
    // =========================================================================

    @Test
    void zeroQuantity_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    @Test
    void negativeQuantity_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": -5.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    // =========================================================================
    // Rule 3: netMass must be positive if present
    // =========================================================================

    @Test
    void zeroNetMass_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 10.0,
                  "netMass": 0.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    @Test
    void absentNetMass_passesValidation() throws Exception {
        // netMass is optional — absence is valid
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 10.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);
        when(exchange.getProperty("CamelSplitIndex", Integer.class)).thenReturn(0);

        processor.process(exchange);

        verify(exchange, never()).setRouteStop(anyBoolean());
    }

    // =========================================================================
    // Rule 4: dutyType must be IMPORT, EXPORT, or EXCISE
    // =========================================================================

    @Test
    void invalidDutyType_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 10.0,
                  "dutyType": "TARIFF"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);
    }

    // =========================================================================
    // Rule 5: cross-field — EXCISE requires exciseProductCode
    // =========================================================================

    @Test
    void exciseDutyTypeWithoutExciseProductCode_returns422() throws Exception {
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 100.0,
                  "dutyType": "EXCISE"
                }
                """;
        when(message.getBody()).thenReturn(json);

        processor.process(exchange);

        verify422Set();
        verify(exchange).setRouteStop(true);

        // Verify error message mentions exciseProductCode
        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(message).setBody(bodyCaptor.capture());
        assertTrue(bodyCaptor.getValue().contains("exciseProductCode"),
                "Error body should mention exciseProductCode");
    }

    @Test
    void importDutyTypeWithoutExciseProductCode_passesValidation() throws Exception {
        // IMPORT does not require exciseProductCode
        String json = """
                {
                  "commodityCode": "2203000100",
                  "quantity": 100.0,
                  "dutyType": "IMPORT"
                }
                """;
        when(message.getBody()).thenReturn(json);
        when(exchange.getProperty("CamelSplitIndex", Integer.class)).thenReturn(0);

        processor.process(exchange);

        verify(exchange, never()).setRouteStop(anyBoolean());
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private void verify422Set() {
        verify(message).setHeader("CamelHttpResponseCode", 422);
    }
}
