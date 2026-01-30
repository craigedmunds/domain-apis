import org.junit.jupiter.api.Test
import static org.junit.jupiter.api.Assertions.*

class BodyUtilsTest {

    @Test
    void 'toString returns null for null input'() {
        assertNull(BodyUtils.toString(null))
    }

    @Test
    void 'toString converts byte array to UTF-8 string'() {
        def bytes = 'Hello World'.getBytes('UTF-8')
        assertEquals('Hello World', BodyUtils.toString(bytes))
    }

    @Test
    void 'toString converts InputStream to string'() {
        def stream = new ByteArrayInputStream('Stream Data'.getBytes('UTF-8'))
        assertEquals('Stream Data', BodyUtils.toString(stream))
    }

    @Test
    void 'toString returns string as-is'() {
        assertEquals('Plain String', BodyUtils.toString('Plain String'))
    }

    @Test
    void 'parseJson returns empty map for null input'() {
        assertEquals([:], BodyUtils.parseJson(null))
    }

    @Test
    void 'parseJson returns empty map for empty string'() {
        assertEquals([:], BodyUtils.parseJson(''))
    }

    @Test
    void 'parseJson parses valid JSON'() {
        def result = BodyUtils.parseJson('{"name": "test", "value": 123}')
        assertEquals('test', result.name)
        assertEquals(123, result.value)
    }

    @Test
    void 'toJson converts map to JSON string'() {
        def map = [name: 'test', value: 123]
        def json = BodyUtils.toJson(map)
        assertTrue(json.contains('"name":"test"'))
        assertTrue(json.contains('"value":123'))
    }
}
