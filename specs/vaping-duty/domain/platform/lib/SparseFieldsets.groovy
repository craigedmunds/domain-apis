/**
 * Sparse Fieldsets Utility
 *
 * Implements JSON:API-style sparse fieldsets for filtering API responses.
 * Supports both top-level and nested field selection using dot notation.
 *
 * Usage:
 *   def result = SparseFieldsets.apply(jsonBody, "field1,field2,nested.field")
 *   if (result.error) {
 *     // Handle validation error
 *     println result.invalidFields
 *   } else if (result.filtered) {
 *     // Use filtered response
 *     println result.body
 *   } else {
 *     // No filtering requested, use original body
 *   }
 */
import groovy.json.JsonSlurper
import groovy.json.JsonOutput

class SparseFieldsets {

    /**
     * Get a nested value from an object using dot notation path.
     *
     * @param obj The object to traverse
     * @param path Dot-separated path (e.g., "trader.address.city")
     * @return The value at the path, or null if not found
     */
    static def getNestedValue(obj, String path) {
        def parts = path.split('\\.')
        def current = obj
        for (part in parts) {
            if (current == null || !(current instanceof Map) || !current.containsKey(part)) {
                return null
            }
            current = current[part]
        }
        return current
    }

    /**
     * Set a nested value in an object using dot notation path.
     * Creates intermediate maps as needed.
     *
     * @param obj The object to modify
     * @param path Dot-separated path
     * @param value The value to set
     */
    static void setNestedValue(Map obj, String path, value) {
        def parts = path.split('\\.')
        def current = obj
        for (int i = 0; i < parts.size() - 1; i++) {
            def part = parts[i]
            if (!current.containsKey(part)) {
                current[part] = [:]
            }
            current = current[part]
        }
        current[parts[-1]] = value
    }

    /**
     * Apply sparse fieldsets filtering to a JSON body.
     *
     * @param jsonBody The JSON string to filter
     * @param fieldsParam Comma-separated list of fields to include
     * @return Map with keys: filtered (boolean), body (String), error (boolean), invalidFields (String)
     */
    static Map apply(String jsonBody, String fieldsParam) {
        // If no fields param, return original body unfiltered
        if (!fieldsParam || fieldsParam.trim().isEmpty()) {
            return [filtered: false, body: jsonBody]
        }

        def slurper = new JsonSlurper()
        def response
        try {
            response = slurper.parseText(jsonBody)
        } catch (Exception e) {
            return [error: true, invalidFields: "Invalid JSON body: ${e.message}"]
        }

        // Parse requested fields (comma-separated, trimmed)
        def requestedFields = fieldsParam.split(',').collect { it.trim() }.findAll { it }

        if (requestedFields.isEmpty()) {
            return [filtered: false, body: jsonBody]
        }

        // Validate all requested fields exist in response
        def invalidFields = []
        for (field in requestedFields) {
            def value = getNestedValue(response, field)
            if (value == null) {
                // Check if it's a top-level field that exists (could be null value)
                if (!field.contains('.') && response instanceof Map && response.containsKey(field)) {
                    continue
                }
                invalidFields.add(field)
            }
        }

        if (invalidFields) {
            return [error: true, invalidFields: invalidFields.join(', ')]
        }

        // Build filtered response with nested structure preserved
        def filtered = [:]
        for (field in requestedFields) {
            if (field.contains('.')) {
                // Nested field - reconstruct the path
                def value = getNestedValue(response, field)
                setNestedValue(filtered, field, value)
            } else {
                // Top-level field
                if (response instanceof Map && response.containsKey(field)) {
                    filtered[field] = response[field]
                }
            }
        }

        return [filtered: true, body: JsonOutput.toJson(filtered)]
    }

    /**
     * Convenience method for use in Camel exchange.
     * Sets properties on the exchange for error handling.
     *
     * @param exchange The Camel exchange
     * @param jsonBody The JSON body to filter
     * @param fieldsParam The fields parameter
     * @return The filtered JSON body (or original if no filtering/error)
     */
    static String applyToExchange(exchange, String jsonBody, String fieldsParam) {
        def result = apply(jsonBody, fieldsParam)

        if (result.error) {
            exchange.setProperty('sparseFieldsetError', true)
            exchange.setProperty('invalidFields', result.invalidFields)
            return jsonBody
        }

        if (result.filtered) {
            return result.body
        }

        return jsonBody
    }
}
