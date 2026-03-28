package uk.gov.hmrc.hip.cd.processor;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.camel.Exchange;
import org.apache.camel.Processor;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.logging.Logger;
import java.util.regex.Pattern;

/**
 * Custom Processor that validates individual goods items before tariff classification.
 *
 * <p>This is a producer-authored Java component for the HIP Simple API pattern.
 * Cross-field validation logic that would be hard to express and test in inline Groovy
 * is expressed here as a unit-testable Java class.
 *
 * <p>Referenced from YAML route via:
 * <pre>
 *   - process:
 *       ref: "#class:uk.gov.hmrc.hip.cd.processor.GoodsItemValidationProcessor"
 * </pre>
 *
 * <h2>Why Java here, not Groovy?</h2>
 * <ul>
 *   <li><b>Cross-field validation</b>: {@code EXCISE} duty type requires {@code exciseProductCode}.
 *       This inter-field rule is hard to express declaratively and error-prone in inline scripts.</li>
 *   <li><b>HS code format validation</b>: 10-digit numeric commodity code with clear regex
 *       — easier to unit-test in isolation than embedded Groovy.</li>
 *   <li><b>Isolation of split legs</b>: on failure, sets {@code routeStop=true} to halt only
 *       this split leg without affecting others. Camel's {@code stopOnException=false} on the
 *       split ensures other items continue.</li>
 * </ul>
 *
 * <h2>Validation rules</h2>
 * <ol>
 *   <li>{@code commodityCode} — must be exactly 10 digits (UK HS code format)</li>
 *   <li>{@code quantity} — must be a positive number</li>
 *   <li>{@code netMass} — must be positive if present</li>
 *   <li>{@code dutyType} — must be one of: {@code IMPORT}, {@code EXPORT}, {@code EXCISE}</li>
 *   <li>Cross-field: {@code EXCISE} requires {@code exciseProductCode} to be present</li>
 * </ol>
 *
 * <p>On validation failure: sets {@code CamelHttpResponseCode=422}, sets error body,
 * and calls {@code exchange.setRouteStop(true)} to halt this leg.
 */
public class GoodsItemValidationProcessor implements Processor {

    private static final Logger LOG = Logger.getLogger(GoodsItemValidationProcessor.class.getName());
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    /** UK HS commodity code: exactly 10 digits */
    private static final Pattern COMMODITY_CODE_PATTERN = Pattern.compile("^\\d{10}$");

    private static final List<String> VALID_DUTY_TYPES = Arrays.asList("IMPORT", "EXPORT", "EXCISE");

    @Override
    public void process(Exchange exchange) throws Exception {
        Object body = exchange.getIn().getBody();
        String json = bodyToString(body);

        Map<String, Object> item;
        try {
            item = MAPPER.readValue(json, MAP_TYPE);
        } catch (Exception e) {
            fail(exchange, "Invalid goods item format: " + e.getMessage());
            return;
        }

        // Rule 1: commodityCode — must be 10-digit numeric string
        String commodityCode = getString(item, "commodityCode");
        if (commodityCode == null || !COMMODITY_CODE_PATTERN.matcher(commodityCode).matches()) {
            fail(exchange, "commodityCode must be a 10-digit numeric UK HS code, got: " + commodityCode);
            return;
        }

        // Rule 2: quantity — must be a positive number
        Number quantity = getNumber(item, "quantity");
        if (quantity == null || quantity.doubleValue() <= 0) {
            fail(exchange, "quantity must be a positive number, got: " + quantity);
            return;
        }

        // Rule 3: netMass — must be positive if present
        Number netMass = getNumber(item, "netMass");
        if (netMass != null && netMass.doubleValue() <= 0) {
            fail(exchange, "netMass must be positive if provided, got: " + netMass);
            return;
        }

        // Rule 4: dutyType — must be one of IMPORT, EXPORT, EXCISE
        String dutyType = getString(item, "dutyType");
        if (dutyType == null || !VALID_DUTY_TYPES.contains(dutyType)) {
            fail(exchange, "dutyType must be one of " + VALID_DUTY_TYPES + ", got: " + dutyType);
            return;
        }

        // Rule 5: cross-field — EXCISE requires exciseProductCode
        if ("EXCISE".equals(dutyType)) {
            String exciseProductCode = getString(item, "exciseProductCode");
            if (exciseProductCode == null || exciseProductCode.isBlank()) {
                fail(exchange, "exciseProductCode is required when dutyType is EXCISE");
                return;
            }
        }

        // Validation passed — store commodity code in header for downstream use
        Integer itemIndex = exchange.getProperty("CamelSplitIndex", Integer.class);
        exchange.getIn().setHeader("itemCommodityCode", commodityCode);
        LOG.info("Goods item validation passed: index=" + itemIndex + ", commodityCode=" + commodityCode);
    }

    /**
     * Marks the exchange as a validation failure for this split leg.
     * Sets HTTP 422 and a JSON error body, then stops this route leg.
     * Other split legs continue (Camel's {@code stopOnException=false} on the split).
     */
    private void fail(Exchange exchange, String reason) throws Exception {
        LOG.warning("Goods item validation failed: " + reason);

        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", "VALIDATION_ERROR");
        error.put("message", reason);

        exchange.getIn().setHeader("CamelHttpResponseCode", 422);
        exchange.getIn().setBody(MAPPER.writeValueAsString(error));
        exchange.setRouteStop(true);
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        String s = val.toString().trim();
        return s.isEmpty() ? null : s;
    }

    private Number getNumber(Map<String, Object> map, String key) {
        Object val = map.get(key);
        if (val == null) return null;
        if (val instanceof Number) return (Number) val;
        try {
            return Double.parseDouble(val.toString());
        } catch (NumberFormatException e) {
            return null;
        }
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
