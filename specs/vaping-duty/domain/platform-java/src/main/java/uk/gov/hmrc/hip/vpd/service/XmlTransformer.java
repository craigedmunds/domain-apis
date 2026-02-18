package uk.gov.hmrc.hip.vpd.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.enterprise.context.ApplicationScoped;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

/**
 * XML to JSON transformer for excise backend responses.
 *
 * <p>The excise service returns XML (legacy system). This class provides the
 * Java equivalent of the inline Groovy XmlSlurper logic in the YAML DSL
 * kamelets, but as a proper unit-testable service.
 *
 * <p>Mirrors kamelets:
 * <ul>
 *   <li>excise-getRegistration.kamelet.yaml</li>
 *   <li>excise-getPeriod.kamelet.yaml</li>
 *   <li>excise-validateAndCalculate.kamelet.yaml</li>
 * </ul>
 */
@ApplicationScoped
public class XmlTransformer {

    private final ObjectMapper mapper = new ObjectMapper();

    /**
     * Transform excise registration XML response to JSON.
     *
     * <p>Input XML structure:
     * <pre>{@code
     * <registration>
     *   <vpdApprovalNumber>VPD123456</vpdApprovalNumber>
     *   <customerId>CUST789</customerId>
     *   <status>ACTIVE</status>
     *   <registeredDate>2024-01-01</registeredDate>
     * </registration>
     * }</pre>
     *
     * @param xml raw XML string from excise backend
     * @return JSON string with registration fields
     */
    public String registrationXmlToJson(String xml) throws Exception {
        Document doc = parseXml(xml);

        ObjectNode result = mapper.createObjectNode();
        result.put("vpdApprovalNumber", text(doc, "vpdApprovalNumber"));
        result.put("customerId", text(doc, "customerId"));
        result.put("status", text(doc, "status"));
        result.put("registeredDate", text(doc, "registeredDate"));

        return mapper.writeValueAsString(result);
    }

    /**
     * Extract customerId from registration XML (without full transform).
     * Used to thread customer ID through the exchange for subsequent calls.
     */
    public String extractCustomerIdFromRegistration(String xml) throws Exception {
        Document doc = parseXml(xml);
        return text(doc, "customerId");
    }

    /**
     * Transform excise period XML response to JSON.
     *
     * <p>Input XML structure:
     * <pre>{@code
     * <period>
     *   <periodKey>24A1</periodKey>
     *   <startDate>2024-01-01</startDate>
     *   <endDate>2024-03-31</endDate>
     *   <state>OPEN</state>
     *   <dutyRates>...</dutyRates>
     * </period>
     * }</pre>
     */
    public String periodXmlToJson(String xml) throws Exception {
        Document doc = parseXml(xml);

        ObjectNode result = mapper.createObjectNode();
        result.put("periodKey", text(doc, "periodKey"));
        result.put("startDate", text(doc, "startDate"));
        result.put("endDate", text(doc, "endDate"));
        result.put("state", text(doc, "state"));

        // dutyRates is a nested element - include as raw text for POC
        String dutyRates = text(doc, "dutyRates");
        if (dutyRates != null && !dutyRates.isBlank()) {
            result.put("dutyRates", dutyRates);
        }

        return mapper.writeValueAsString(result);
    }

    /**
     * Transform excise validate-and-calculate XML response to JSON.
     *
     * <p>Input XML structure:
     * <pre>{@code
     * <validation>
     *   <valid>true</valid>
     *   <customerId>CUST789</customerId>
     *   <calculations>
     *     <totalDutyDue currency="GBP">12345.67</totalDutyDue>
     *     <vat>2469.13</vat>
     *     <calculationHash>sha256:abc123def456</calculationHash>
     *   </calculations>
     *   <warnings>
     *     <warning code="WARN-VD-001">Spoilt product close to upper threshold</warning>
     *   </warnings>
     * </validation>
     * }</pre>
     *
     * @return JSON with { valid, customerId, calculations: { totalDutyDue, vat, calculationHash }, warnings: [] }
     */
    public ValidationResult validateAndCalculateXmlToJson(String xml) throws Exception {
        Document doc = parseXml(xml);

        boolean valid = "true".equals(text(doc, "valid"));
        String customerId = text(doc, "customerId");

        // Calculations
        ObjectNode calculations = mapper.createObjectNode();

        ObjectNode totalDutyDue = mapper.createObjectNode();
        NodeList dutyNodes = doc.getElementsByTagName("totalDutyDue");
        if (dutyNodes.getLength() > 0) {
            org.w3c.dom.Element dutyEl = (org.w3c.dom.Element) dutyNodes.item(0);
            String amount = dutyEl.getTextContent();
            String currency = dutyEl.getAttribute("currency");
            totalDutyDue.put("amount", amount.isBlank() ? 0.0 : Double.parseDouble(amount));
            totalDutyDue.put("currency", currency.isBlank() ? "GBP" : currency);
        }
        calculations.set("totalDutyDue", totalDutyDue);

        ObjectNode vat = mapper.createObjectNode();
        vat.put("amount", parseDouble(text(doc, "vat"), 0.0));
        vat.put("currency", "GBP");
        calculations.set("vat", vat);

        calculations.put("calculationHash", text(doc, "calculationHash"));

        // Warnings
        ArrayNode warnings = mapper.createArrayNode();
        NodeList warningNodes = doc.getElementsByTagName("warning");
        for (int i = 0; i < warningNodes.getLength(); i++) {
            org.w3c.dom.Element w = (org.w3c.dom.Element) warningNodes.item(i);
            ObjectNode warning = mapper.createObjectNode();
            warning.put("code", w.getAttribute("code"));
            warning.put("text", w.getTextContent());
            warnings.add(warning);
        }

        ObjectNode result = mapper.createObjectNode();
        result.put("valid", valid);
        result.put("customerId", customerId);
        result.set("calculations", calculations);
        result.set("warnings", warnings);

        return new ValidationResult(valid, customerId, mapper.writeValueAsString(result));
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private Document parseXml(String xml) throws Exception {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        // Disable external entity processing (security)
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        return factory.newDocumentBuilder()
                .parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
    }

    private String text(Document doc, String tagName) {
        NodeList nodes = doc.getElementsByTagName(tagName);
        if (nodes.getLength() == 0) return "";
        return nodes.item(0).getTextContent();
    }

    private double parseDouble(String value, double defaultValue) {
        if (value == null || value.isBlank()) return defaultValue;
        try { return Double.parseDouble(value); } catch (NumberFormatException e) { return defaultValue; }
    }

    /**
     * Result of the validate-and-calculate transform, carrying the valid flag
     * and customerId so the route can make routing decisions without
     * re-parsing the JSON.
     */
    public record ValidationResult(boolean valid, String customerId, String json) {}
}
