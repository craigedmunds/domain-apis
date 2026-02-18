package uk.gov.hmrc.hip.vpd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;

import java.util.*;

/**
 * Builds domain API response bodies.
 *
 * <p>Java equivalent of the inline Groovy logic in the YAML DSL routes:
 * <ul>
 *   <li>{@code common.yaml#assembleSubmissionReturnResponse}</li>
 *   <li>{@code post-submission-return.yaml} (POST response assembly)</li>
 *   <li>{@code common.yaml#applySparseFieldsets}</li>
 * </ul>
 *
 * <p>Unlike the YAML DSL, this code is fully unit-testable without running Camel.
 */
@ApplicationScoped
public class ResponseBuilder {

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Assemble enriched GET response from all four backend responses.
     *
     * <p>Mirrors {@code assembleSubmissionReturnResponse} in common.yaml.
     *
     * @param taxPlatformJson  submission data from tax-platform
     * @param customerJson     trader data from customer service
     * @param registrationJson registration data from excise (already JSON-transformed)
     * @param periodJson       period data from excise (already JSON-transformed)
     * @return enriched JSON response string
     */
    public String assembleGetResponse(
            String taxPlatformJson,
            String customerJson,
            String registrationJson,
            String periodJson
    ) throws Exception {
        ObjectNode submission = parseObject(taxPlatformJson);

        JsonNode customer = parse(customerJson);
        if (customer != null && !customer.isNull()) {
            ObjectNode trader = mapper.createObjectNode();
            trader.set("name", customer.get("name"));
            trader.set("type", customer.get("type"));
            trader.set("address", customer.path("registeredAddress"));
            submission.set("trader", trader);
        }

        JsonNode registration = parse(registrationJson);
        if (registration != null && !registration.isNull()) {
            ObjectNode reg = mapper.createObjectNode();
            reg.set("status", registration.path("status"));
            reg.set("registeredDate", registration.path("registeredDate"));
            submission.set("registration", reg);
        }

        JsonNode period = parse(periodJson);
        if (period != null && !period.isNull()) {
            ObjectNode p = mapper.createObjectNode();
            p.set("startDate", period.path("startDate"));
            p.set("endDate", period.path("endDate"));
            p.set("state", period.path("state"));
            p.set("dutyRates", period.path("dutyRates"));
            submission.set("period", p);
        }

        return mapper.writeValueAsString(submission);
    }

    /**
     * Build POST 201 response body.
     *
     * <p>Mirrors the final Groovy block in {@code post-submission-return.yaml}.
     *
     * @param taxPlatformStoreJson  store response from tax-platform (contains acknowledgementReference, storedAt)
     * @param customerJson          customer response (for trader enrichment)
     * @param exciseValidationJson  validation response (calculations, warnings)
     * @param vpdApprovalNumber     from original request
     * @param periodKey             from original request
     * @return JSON string for 201 response
     */
    public String assemblePostResponse(
            String taxPlatformStoreJson,
            String customerJson,
            String exciseValidationJson,
            String vpdApprovalNumber,
            String periodKey
    ) throws Exception {
        JsonNode storeResult = parse(taxPlatformStoreJson);
        JsonNode customer = parse(customerJson);
        JsonNode validation = parse(exciseValidationJson);

        ObjectNode response = mapper.createObjectNode();
        response.set("acknowledgementReference",
                storeResult != null ? storeResult.path("acknowledgementReference") : mapper.nullNode());
        response.put("vpdApprovalNumber", vpdApprovalNumber);
        response.put("periodKey", periodKey);
        response.put("status", "RECEIVED");
        response.set("storedAt", storeResult != null ? storeResult.path("storedAt") : mapper.nullNode());

        if (customer != null && !customer.isNull()) {
            ObjectNode trader = mapper.createObjectNode();
            trader.set("name", customer.path("name"));
            trader.set("type", customer.path("type"));
            response.set("trader", trader);
        }

        response.set("calculations", validation != null ? validation.path("calculations") : mapper.nullNode());
        response.set("warnings", validation != null ? validation.path("warnings") : mapper.createArrayNode());

        return mapper.writeValueAsString(response);
    }

    /**
     * Build 422 validation error response body.
     *
     * <p>Mirrors the Groovy block in the {@code validationValid == false} branch
     * of {@code post-submission-return.yaml}.
     */
    public String buildValidationErrorResponse(String exciseValidationJson) throws Exception {
        JsonNode validation = parse(exciseValidationJson);

        ObjectNode error = mapper.createObjectNode();
        error.put("code", "VALIDATION_FAILED");
        error.put("message", "Submission failed validation");
        error.set("warnings", validation != null ? validation.path("warnings") : mapper.createArrayNode());

        return mapper.writeValueAsString(error);
    }

    /**
     * Build the store request body for tax-platform.
     *
     * <p>Mirrors the Groovy block in step 3 of {@code post-submission-return.yaml}.
     *
     * @param originalRequestJson   the client's original POST body
     * @param exciseValidationJson  validation response (customerId, calculations, warnings)
     * @return JSON string for tax-platform store request
     */
    public String buildStoreRequest(String originalRequestJson, String exciseValidationJson) throws Exception {
        JsonNode original = parse(originalRequestJson);
        JsonNode validation = parse(exciseValidationJson);

        ObjectNode storeRequest = mapper.createObjectNode();
        storeRequest.set("vpdApprovalNumber", original != null ? original.path("vpdApprovalNumber") : mapper.nullNode());
        storeRequest.set("periodKey", original != null ? original.path("periodKey") : mapper.nullNode());
        storeRequest.set("customerId", validation != null ? validation.path("customerId") : mapper.nullNode());
        storeRequest.set("submission", original);
        storeRequest.set("calculations", validation != null ? validation.path("calculations") : mapper.nullNode());
        storeRequest.set("warnings", validation != null ? validation.path("warnings") : mapper.createArrayNode());

        return mapper.writeValueAsString(storeRequest);
    }

    /**
     * Apply sparse fieldsets filtering to a response body.
     *
     * <p>Mirrors {@code applySparseFieldsets} in common.yaml.
     *
     * @param responseJson    full response JSON
     * @param fieldsParam     comma-separated field paths (may be null/blank for no filtering)
     * @return SparseResult with either the filtered JSON or an error description
     */
    public SparseResult applySparseFieldsets(String responseJson, String fieldsParam) throws Exception {
        if (fieldsParam == null || fieldsParam.isBlank()) {
            return new SparseResult(responseJson, null);
        }

        JsonNode response = parse(responseJson);
        if (response == null) {
            return new SparseResult(responseJson, null);
        }

        String[] requestedFields = Arrays.stream(fieldsParam.split(","))
                .map(String::trim)
                .filter(f -> !f.isBlank())
                .toArray(String[]::new);

        // Validate all fields exist
        List<String> invalidFields = new ArrayList<>();
        for (String field : requestedFields) {
            JsonNode value = getNestedValue(response, field);
            if (value == null || value.isMissingNode()) {
                invalidFields.add(field);
            }
        }

        if (!invalidFields.isEmpty()) {
            return new SparseResult(null, String.join(", ", invalidFields));
        }

        // Build filtered response
        ObjectNode filtered = mapper.createObjectNode();
        for (String field : requestedFields) {
            JsonNode value = getNestedValue(response, field);
            setNestedValue(filtered, field, value);
        }

        return new SparseResult(mapper.writeValueAsString(filtered), null);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private JsonNode getNestedValue(JsonNode node, String path) {
        String[] parts = path.split("\\.");
        JsonNode current = node;
        for (String part : parts) {
            if (current == null || current.isMissingNode() || !current.isObject()) {
                return null;
            }
            current = current.path(part);
        }
        return current;
    }

    private void setNestedValue(ObjectNode root, String path, JsonNode value) {
        String[] parts = path.split("\\.");
        ObjectNode current = root;
        for (int i = 0; i < parts.length - 1; i++) {
            String part = parts[i];
            if (!current.has(part)) {
                current.set(part, mapper.createObjectNode());
            }
            current = (ObjectNode) current.get(part);
        }
        current.set(parts[parts.length - 1], value);
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try { return mapper.readTree(json); } catch (Exception e) { return null; }
    }

    private ObjectNode parseObject(String json) {
        if (json == null || json.isBlank()) return mapper.createObjectNode();
        try {
            JsonNode node = mapper.readTree(json);
            return node.isObject() ? (ObjectNode) node : mapper.createObjectNode();
        } catch (Exception e) {
            return mapper.createObjectNode();
        }
    }

    /**
     * Result of sparse fieldset application.
     *
     * @param json         filtered JSON (null if there was an error)
     * @param invalidFields  comma-joined invalid field names (null on success)
     */
    public record SparseResult(String json, String invalidFields) {
        public boolean hasError() { return invalidFields != null; }
    }
}
