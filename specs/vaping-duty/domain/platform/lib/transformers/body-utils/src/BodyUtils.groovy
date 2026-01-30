/**
 * Utility methods for handling request/response bodies.
 */
class BodyUtils {

    /**
     * Convert body to String, handling byte arrays and InputStreams.
     */
    static String toString(body) {
        if (body == null) {
            return null
        }
        if (body instanceof byte[]) {
            return new String(body, 'UTF-8')
        }
        if (body instanceof InputStream) {
            return new String(body.bytes, 'UTF-8')
        }
        return body.toString()
    }

    /**
     * Parse JSON body to Map.
     */
    static Map parseJson(String jsonText) {
        if (!jsonText) {
            return [:]
        }
        def slurper = new groovy.json.JsonSlurper()
        return slurper.parseText(jsonText)
    }

    /**
     * Convert Map to JSON string.
     */
    static String toJson(Map data) {
        return groovy.json.JsonOutput.toJson(data)
    }
}
