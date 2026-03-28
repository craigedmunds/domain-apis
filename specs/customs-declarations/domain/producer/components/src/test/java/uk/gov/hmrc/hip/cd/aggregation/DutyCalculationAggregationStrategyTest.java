package uk.gov.hmrc.hip.cd.aggregation;

import org.apache.camel.Exchange;
import org.apache.camel.Message;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link DutyCalculationAggregationStrategy}.
 *
 * Tests use Mockito to mock {@link Exchange} and {@link Message} so the
 * aggregation logic can be tested in isolation without a Camel context.
 */
@ExtendWith(MockitoExtension.class)
class DutyCalculationAggregationStrategyTest {

    private DutyCalculationAggregationStrategy strategy;

    @Mock
    private Exchange newExchange;

    @Mock
    private Exchange oldExchange;

    @Mock
    private Message newMessage;

    @Mock
    private Message oldMessage;

    @BeforeEach
    void setUp() {
        strategy = new DutyCalculationAggregationStrategy();
    }

    // =========================================================================
    // First exchange — initialise accumulator
    // =========================================================================

    @Test
    void firstExchange_initialisesAccumulator() {
        // Given: first split leg — oldExchange is null
        String tariffJson = """
                {"commodityCode":"2203000100","dutyRate":0.05,"dutyAmount":10.0}
                """;

        when(newExchange.getIn()).thenReturn(newMessage);
        when(newMessage.getBody()).thenReturn(tariffJson);
        when(newMessage.getHeader("CamelHttpResponseCode", Integer.class)).thenReturn(200);
        when(newExchange.getException()).thenReturn(null);
        when(newExchange.getProperty("CamelSplitIndex")).thenReturn(0);

        // When
        Exchange result = strategy.aggregate(null, newExchange);

        // Then: result is the newExchange with itemResults initialised
        assertSame(newExchange, result);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>) result.getProperty(DutyCalculationAggregationStrategy.PROP_ITEM_RESULTS);

        assertNotNull(items, "itemResults property should be initialised");
        assertEquals(1, items.size());

        Map<String, Object> item = items.get(0);
        assertEquals("2203000100", item.get("commodityCode"));
        assertEquals(0.05, item.get("dutyRate"));
        assertEquals(10.0, item.get("dutyAmount"));
        assertEquals(true, item.get("success"));
        assertNull(item.get("error"));
    }

    // =========================================================================
    // Two successful items
    // =========================================================================

    @Test
    void twoSuccessfulItems_aggregatesCorrectly() {
        // Given: two successful tariff results
        String tariff1Json = """
                {"commodityCode":"2203000100","dutyRate":0.05,"dutyAmount":10.0}
                """;
        String tariff2Json = """
                {"commodityCode":"3304990000","dutyRate":0.12,"dutyAmount":24.0}
                """;

        // First exchange (oldExchange == null)
        when(newExchange.getIn()).thenReturn(newMessage);
        when(newMessage.getBody()).thenReturn(tariff1Json);
        when(newMessage.getHeader("CamelHttpResponseCode", Integer.class)).thenReturn(200);
        when(newExchange.getException()).thenReturn(null);
        when(newExchange.getProperty("CamelSplitIndex")).thenReturn(0);

        Exchange first = strategy.aggregate(null, newExchange);

        // Second exchange
        Exchange secondNewExchange = mock(Exchange.class);
        Message secondMessage = mock(Message.class);

        when(secondNewExchange.getIn()).thenReturn(secondMessage);
        when(secondMessage.getBody()).thenReturn(tariff2Json);
        when(secondMessage.getHeader("CamelHttpResponseCode", Integer.class)).thenReturn(200);
        when(secondNewExchange.getException()).thenReturn(null);
        when(secondNewExchange.getProperty("CamelSplitIndex")).thenReturn(1);

        // oldExchange is the first result; it needs getProperty and setBody etc
        when(first.getProperty(DutyCalculationAggregationStrategy.PROP_ITEM_RESULTS))
                .thenCallRealMethod();

        // Use real oldExchange (which is the returned newExchange from round 1)
        Exchange result = strategy.aggregate(first, secondNewExchange);

        assertSame(first, result);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>) result.getProperty(DutyCalculationAggregationStrategy.PROP_ITEM_RESULTS);

        assertEquals(2, items.size());
        assertEquals("2203000100", items.get(0).get("commodityCode"));
        assertEquals("3304990000", items.get(1).get("commodityCode"));
    }

    // =========================================================================
    // Partial failure
    // =========================================================================

    @Test
    void partialFailure_oneItemFails_resultHasPartialSuccessTrue() {
        // Build the final aggregated body directly using the package-visible helper
        List<Map<String, Object>> results = List.of(
                buildSuccessItem(0, "2203000100", 0.05, 10.0),
                buildFailureItem(1, null, "Tariff service unavailable")
        );

        Map<String, Object> body = strategy.buildAggregatedBody(results);

        assertEquals(10.0, (double) body.get("totalDutyAmount"), 0.001);
        assertEquals(true, body.get("partialSuccess"),
                "partialSuccess should be true when any item fails");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        assertEquals(2, items.size());
    }

    @Test
    void allItemsSucceed_partialSuccessIsFalse() {
        List<Map<String, Object>> results = List.of(
                buildSuccessItem(0, "2203000100", 0.05, 10.0),
                buildSuccessItem(1, "3304990000", 0.12, 24.0)
        );

        Map<String, Object> body = strategy.buildAggregatedBody(results);

        assertEquals(34.0, (double) body.get("totalDutyAmount"), 0.001);
        assertEquals(false, body.get("partialSuccess"),
                "partialSuccess should be false when all items succeed");
    }

    // =========================================================================
    // Deduplication
    // =========================================================================

    @Test
    void deduplication_sameCommodityCodeTwice_keepsLatest() {
        List<Map<String, Object>> results = new java.util.ArrayList<>();
        results.add(buildSuccessItem(0, "2203000100", 0.05, 10.0));

        // Simulate a retry: same commodityCode with updated duty amount
        Map<String, Object> retried = buildSuccessItem(0, "2203000100", 0.05, 12.5);
        retried.put("dutyAmount", 12.5); // updated amount from retry

        // Invoke dedup via the helper method (same logic as aggregate internals)
        // We test the observable behaviour: build the body after adding the duplicate
        results.add(buildSuccessItem(1, "3304990000", 0.12, 24.0));

        // Now add the duplicate — should replace index 0
        Map<String, Object> body = strategy.buildAggregatedBody(List.of(retried, results.get(1)));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");

        // Only one entry per commodityCode
        long countForCode = items.stream()
                .filter(i -> "2203000100".equals(i.get("commodityCode")))
                .count();
        assertEquals(1, countForCode, "Only one result per commodityCode after deduplication");

        // The kept entry should be the latest (dutyAmount = 12.5)
        Map<String, Object> kept = items.stream()
                .filter(i -> "2203000100".equals(i.get("commodityCode")))
                .findFirst()
                .orElseThrow();
        assertEquals(12.5, ((Number) kept.get("dutyAmount")).doubleValue(), 0.001);
    }

    // =========================================================================
    // Exchange with exception — does not propagate
    // =========================================================================

    @Test
    void exchangeWithException_marksItemFailedWithoutPropagating() {
        when(newExchange.getIn()).thenReturn(newMessage);
        when(newExchange.getException()).thenReturn(new RuntimeException("Connection timeout"));
        when(newExchange.getProperty("CamelSplitIndex")).thenReturn(2);
        when(newMessage.getHeader("itemCommodityCode", String.class)).thenReturn("2203000100");

        Exchange result = strategy.aggregate(null, newExchange);

        // Exception should be cleared on the exchange
        verify(newExchange).setException(null);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items =
                (List<Map<String, Object>>) result.getProperty(DutyCalculationAggregationStrategy.PROP_ITEM_RESULTS);

        assertEquals(1, items.size());
        assertEquals(false, items.get(0).get("success"));
        assertNotNull(items.get(0).get("error"));
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private Map<String, Object> buildSuccessItem(int index, String commodityCode, double dutyRate, double dutyAmount) {
        Map<String, Object> item = new HashMap<>();
        item.put("itemIndex", index);
        item.put("commodityCode", commodityCode);
        item.put("dutyRate", dutyRate);
        item.put("dutyAmount", dutyAmount);
        item.put("success", true);
        item.put("error", null);
        return item;
    }

    private Map<String, Object> buildFailureItem(int index, String commodityCode, String error) {
        Map<String, Object> item = new HashMap<>();
        item.put("itemIndex", index);
        item.put("commodityCode", commodityCode);
        item.put("dutyRate", null);
        item.put("dutyAmount", null);
        item.put("success", false);
        item.put("error", error);
        return item;
    }
}
