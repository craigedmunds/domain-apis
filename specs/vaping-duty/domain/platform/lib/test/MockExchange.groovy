/**
 * Simple mock Exchange for testing Groovy lib classes.
 * Uses duck typing instead of implementing Camel interfaces to avoid version coupling.
 */
class MockExchange {
    private Map<String, Object> properties = [:]

    Object getProperty(String name) {
        return properties[name]
    }

    Object getProperty(String name, Class type) {
        return properties[name]
    }

    void setProperty(String name, Object value) {
        properties[name] = value
    }

    // Helper for tests to set multiple properties at once
    void setProperties(Map<String, Object> props) {
        this.properties.putAll(props)
    }
}
