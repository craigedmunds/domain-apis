package uk.gov.hmrc.hip.cd.aggregation;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.AggregationStrategy;
import org.apache.camel.Exchange;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Custom AggregationStrategy for split goods items in a customs declaration.
 *
 * <p>This is a producer-authored Java component for the HIP Simple API pattern.
 * Complex aggregation logic that would be unwieldy in YAML/Groovy is expressed
 * here as a unit-testable Java class, while the YAML route handles orchestration.
 *
 * <p>Referenced from YAML route via:
 * <pre>
 *   aggregationStrategy: "#class:uk.gov.hmrc.hip.cd.aggregation.DutyCalculationAggregationStrategy"
 * </pre>
 *
 * <h2>Why Java here, not Groovy?</h2>
 * <ul>
 *   <li><b>Partial failure semantics</b>: one item failing must not fail the whole exchange.
 *       Groovy inline scripts cannot cleanly isolate per-item exceptions during parallel split.</li>
 *   <li><b>Deduplication</b>: if the same {@code commodityCode} appears twice (e.g. a retry),
 *       we keep the latest result. This requires a keyed accumulator — awkward in Groovy inline.</li>
 *   <li><b>Unit testability</b>: aggregation logic can be tested in isolation via JUnit/Mockito
 *       without spinning up a Camel context.</li>
 * </ul>
 *
 * <h2>Accumulator lifecycle</h2>
 * <ol>
 *   <li>First call ({@code oldExchange == null}): initialise {@code itemResults} list in
 *       the new exchange's properties.</li>
 *   <li>Subsequent calls: extract result from {@code newExchange}, deduplicate by
 *       {@code commodityCode}, append to {@code itemResults} in {@code oldExchange}.</li>
 *   <li>Camel calls this for every split leg. The final exchange is returned to the route
 *       with body set to the aggregated JSON object.</li>
 * </ol>
 */
public class DutyCalculationAggregationStrategy implements AggregationStrategy {

    private static final Logger LOG = Logger.getLogger(DutyCalculationAggregationStrategy.class.getName());
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    static final String PROP_ITEM_RESULTS = "itemResults";

    @Override
    public Exchange aggregate(Exchange oldExchange, Exchange newExchange) {
        // --- First item: initialise accumulator ---
        if (oldExchange == null) {
            List<Map<String, Object>> results = new ArrayList<>();
            Map<String, Object> itemResult = extractItemResult(newExchange);
            results.add(itemResult);
            newExchange.setProperty(PROP_ITEM_RESULTS, results);
            return newExchange;
        }

        // --- Subsequent items: merge into accumulator ---
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> results =
                (List<Map<String, Object>>) oldExchange.getProperty(PROP_ITEM_RESULTS);
        if (results == null) {
            results = new ArrayList<>();
            oldExchange.setProperty(PROP_ITEM_RESULTS, results);
        }

        Map<String, Object> itemResult = extractItemResult(newExchange);
        deduplicateAndAdd(results, itemResult);

        // Set final aggregated body on the last exchange Camel returns
        oldExchange.getIn().setBody(buildAggregatedBody(results));
        return oldExchange;
    }

    /**
     * Extracts a result map from the exchange.
     * If the exchange carries an exception or a failure header, marks the item as failed
     * without propagating the exception — other items continue processing.
     */
    private Map<String, Object> extractItemResult(Exchange exchange) {
        Map<String, Object> result = new LinkedHashMap<>();

        // Carry item index for ordered response
        Object itemIndex = exchange.getProperty("CamelSplitIndex");
        result.put("itemIndex", itemIndex instanceof Integer ? itemIndex : 0);

        // Check for exception on the exchange leg
        Exception cause = exchange.getException();
        if (cause != null) {
            LOG.log(Level.WARNING, "Goods item leg failed with exception; marking as failed", cause);
            result.put("commodityCode", exchange.getIn().getHeader("itemCommodityCode", String.class));
            result.put("dutyRate", null);
            result.put("dutyAmount", null);
            result.put("success", false);
            result.put("error", cause.getMessage());
            // Clear the exception so it does not propagate
            exchange.setException(null);
            return result;
        }

        // Check for HTTP-level failure from the tariff API call
        Integer responseCode = exchange.getIn().getHeader("CamelHttpResponseCode", Integer.class);
        if (responseCode != null && responseCode >= 400) {
            LOG.warning("Goods item leg returned HTTP " + responseCode + "; marking as failed");
            result.put("commodityCode", exchange.getIn().getHeader("itemCommodityCode", String.class));
            result.put("dutyRate", null);
            result.put("dutyAmount", null);
            result.put("success", false);
            result.put("error", "Tariff classification returned HTTP " + responseCode);
            return result;
        }

        // Happy path: parse body as tariff classification response
        try {
            Object body = exchange.getIn().getBody();
            String json = bodyToString(body);
            Map<String, Object> tariffResult = MAPPER.readValue(json, MAP_TYPE);

            result.put("commodityCode", tariffResult.getOrDefault("commodityCode", null));
            result.put("dutyRate", tariffResult.getOrDefault("dutyRate", null));
            result.put("dutyAmount", tariffResult.getOrDefault("dutyAmount", null));
            result.put("success", true);
            result.put("error", null);
        } catch (Exception e) {
            LOG.log(Level.WARNING, "Failed to parse tariff classification response; marking item as failed", e);
            result.put("commodityCode", null);
            result.put("dutyRate", null);
            result.put("dutyAmount", null);
            result.put("success", false);
            result.put("error", "Failed to parse tariff response: " + e.getMessage());
        }

        return result;
    }

    /**
     * Deduplication: if the same {@code commodityCode} already exists in the results list,
     * replace it with the new result (keeps the latest — e.g. a retried item).
     * Otherwise, append.
     */
    private void deduplicateAndAdd(List<Map<String, Object>> results, Map<String, Object> newItem) {
        String newCode = (String) newItem.get("commodityCode");
        if (newCode != null) {
            for (int i = 0; i < results.size(); i++) {
                if (newCode.equals(results.get(i).get("commodityCode"))) {
                    LOG.info("Deduplicating commodityCode=" + newCode + " — replacing with latest result");
                    results.set(i, newItem);
                    return;
                }
            }
        }
        results.add(newItem);
    }

    /**
     * Builds the final aggregated response body.
     *
     * <pre>
     * {
     *   "items": [...],
     *   "totalDutyAmount": 12.34,
     *   "partialSuccess": false
     * }
     * </pre>
     */
    Map<String, Object> buildAggregatedBody(List<Map<String, Object>> results) {
        double totalDuty = 0.0;
        boolean anyFailure = false;

        for (Map<String, Object> item : results) {
            Object amount = item.get("dutyAmount");
            if (amount instanceof Number) {
                totalDuty += ((Number) amount).doubleValue();
            }
            Boolean success = (Boolean) item.get("success");
            if (Boolean.FALSE.equals(success)) {
                anyFailure = true;
            }
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("items", results);
        body.put("totalDutyAmount", Math.round(totalDuty * 100.0) / 100.0);
        body.put("partialSuccess", anyFailure);
        return body;
    }

    private String bodyToString(Object body) {
        if (body == null) return "{}";
        if (body instanceof byte[]) return new String((byte[]) body);
        if (body instanceof java.io.InputStream) {
            try {
                return new String(((java.io.InputStream) body).readAllBytes());
            } catch (Exception e) {
                return "{}";
            }
        }
        return body.toString();
    }
}
