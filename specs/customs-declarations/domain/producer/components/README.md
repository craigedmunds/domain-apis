# Customs Declarations — Producer-Authored Java Components

This directory demonstrates the **HIP producer-authored Java component pattern**:
complex business logic that exceeds what Camel YAML DSL and Groovy can cleanly express
is authored as Java classes, built into a JAR, and included on the Camel pipeline's classpath.
The pipeline remains YAML; Java handles the hard parts.

---

## When to use Java vs YAML/Groovy

| Scenario | Use YAML/Groovy | Use Java |
|----------|----------------|----------|
| Simple field extraction or mapping | yes | |
| Conditional routing by field value | yes | |
| Aggregation: list collection, sum | yes | |
| Aggregation: partial failure, dedup | | yes |
| Validation: single-field format check | yes (Groovy) | |
| Validation: cross-field rules | | yes |
| Transformation: JSON field rename | yes | |
| Scatter-gather with timeout/failure policy | | yes |
| Any logic you want to unit-test in isolation | | yes |

The driving principle: YAML for orchestration and simple steps, Java for complex business
logic. See [plan.md](../../../../../.ai/projects/hip/simple-api-enhancements/plan.md) §7
for the full pattern table.

---

## Java components

### `DutyCalculationAggregationStrategy`

**Package**: `uk.gov.hmrc.hip.cd.aggregation`

Implements `AggregationStrategy` for the Splitter/Aggregator pattern over `goodsItems`.

**Problem solved**: A YAML `group` + Groovy aggregation cannot cleanly handle:
- **Partial failure** — one item's tariff classification failing must not fail all items.
  The strategy catches per-item exceptions, marks the item as failed, and continues.
- **Deduplication** — if the same `commodityCode` appears twice (e.g. retry), keeps the
  latest result rather than accumulating duplicates.

**Output shape**:
```json
{
  "items": [
    { "itemIndex": 0, "commodityCode": "2203000100", "dutyRate": 0.05, "dutyAmount": 10.0, "success": true, "error": null },
    { "itemIndex": 1, "commodityCode": "3304990000", "dutyRate": null, "dutyAmount": null, "success": false, "error": "..." }
  ],
  "totalDutyAmount": 10.0,
  "partialSuccess": true
}
```

### `GoodsItemValidationProcessor`

**Package**: `uk.gov.hmrc.hip.cd.processor`

Implements `Processor` for per-item validation before the tariff classification call.

**Problem solved**: Cross-field validation rules are awkward in inline Groovy:
- `commodityCode` must match the 10-digit UK HS code format (`^\d{10}$`)
- `quantity` must be positive
- `netMass` must be positive if present
- `dutyType` must be one of `IMPORT`, `EXPORT`, `EXCISE`
- **Cross-field**: `EXCISE` requires `exciseProductCode` to be present

On failure: sets `CamelHttpResponseCode: 422`, writes a JSON error body, and calls
`exchange.setRouteStop(true)` to halt only this split leg — other items continue.

---

## How YAML references Java components (`#class:` syntax)

The YAML route uses `#class:full.class.Name` to reference Java components:

```yaml
# Aggregation strategy on the split
- split:
    jsonpath: "$.goodsItems"
    aggregationStrategy: "#class:uk.gov.hmrc.hip.cd.aggregation.DutyCalculationAggregationStrategy"
    parallelProcessing: true
    stopOnException: false
    steps:
      # Processor in the split body
      - process:
          ref: "#class:uk.gov.hmrc.hip.cd.processor.GoodsItemValidationProcessor"
```

Camel JBang instantiates the class from the JAR on the classpath at startup. The JAR is
supplied via `--dep=file:///path/to.jar` (see Dockerfile `CMD`).

---

## Build

```bash
# Compile and package the JAR (skipping tests for speed)
mvn package -DskipTests

# Compile, run tests, and package
mvn package
```

Output: `target/customs-declarations-components-1.0.0.jar`

---

## Run with Docker

```bash
# Build the image (Maven build + Camel JBang runtime in one multi-stage build)
docker build -t cd-components .

# Run the Camel pipeline (listens on port 8080)
docker run -p 8080:8080 cd-components
```

The Dockerfile's `CMD` starts:
```
camel run /routes/post-declaration-java.yaml \
  --dep=camel:jackson \
  --dep=file:///deps/customs-declarations-components.jar
```

This tells Camel JBang to add the producer JAR to the classpath so `#class:` references resolve.

---

## File layout

```
components/
├── pom.xml                                          Maven project (groupId: uk.gov.hmrc.hip)
├── Dockerfile                                       Multi-stage: Maven build → Camel JBang
├── README.md                                        This file
├── routes/
│   ├── post-declaration-java.yaml                   YAML route using #class: Java components
│   └── common.yaml                                  Shared extractStandardHeaders / injectResponseHeaders
└── src/
    ├── main/java/uk/gov/hmrc/hip/cd/
    │   ├── aggregation/DutyCalculationAggregationStrategy.java
    │   └── processor/GoodsItemValidationProcessor.java
    └── test/java/uk/gov/hmrc/hip/cd/
        ├── aggregation/DutyCalculationAggregationStrategyTest.java
        └── processor/GoodsItemValidationProcessorTest.java
```
