# Self-Aware Infrastructure & Topology

Serverless Claw implements a **Self-Aware Infrastructure** model. Rather than relying on hardcoded diagrams, the system discovers its own topology post-deployment.

## Discovery Mechanism

Every successful deployment triggers a system-wide scan to map resources and agent connections.

```text
  [ CodeBuild ] ----> [ SUCCEEDED ]
                          |
                          v
                  [ Build Monitor ]
                          |
             +------------+------------+
             |                         |
       (Scan Agents)              (Scan Infra)
       Registry.json <-----------> SST.link
             |                         |
             +------------+------------+
                          |
                          v
                [ System Topology ]
                (Stored in Config)
```

## Data Sources

1. **SST Resource Scanning**: Extracts metadata from the `Resource` object provided by SST v3 (e.g., Table names, Bucket URIs, Bus names).
2. **Agent Registry**: Inspects the `BACKBONE_REGISTRY` and dynamic entries in DynamoDB to map logical agent relationships.
3. **IAM Links**: Validates the hard security layer by checking Lambda function permissions.

## Visualization
The resulting JSON graph is rendered on the **System Pulse** map in ClawCenter, providing a live "circulatory system" view of the stack.
