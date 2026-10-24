# What is needed before real-world use

TileTwin AI is a portfolio demonstration on **synthetic data** for a fictional plant. Nothing in it
has been validated against a real site. This list covers what a company would have to provide or do.

## Real site data

- **Plant model**: real zones, machine inventory, IDs, manufacturers/models (now "Unknown (demo)").
- **Sensor definitions and limits**: real tags, units and warning/critical limits agreed with process
  and maintenance engineers. Current limits are illustrative.
- **Data integration**: a connector from the plant historian / SCADA / OPC UA / MQTT into
  `SensorReadings` instead of the simulator, with timestamps, units and data-quality flags.
- **Inspection, maintenance and production records**: integration with the CMMS / EAM and MES (now seeded demo records).
- **3D layout**: a real site layout and optional GLB models (`3d-assets/asset-manifest.json`); current geometry is illustrative.
- **Data retention, partitioning and archiving** for high-frequency readings (the demo keeps everything in one table).

## Models and keys

- **Anomaly models**: retrain per machine (or type) on real normal-operation history; re-calibrate
  thresholds; evaluate against labelled real events; monitor false-alarm rates. The numbers in
  `docs/ML-EVALUATION.md` are synthetic-only.
- **Failure prediction**: not implemented. Needs labelled failure history.
- **Tile defect model**: a trained ONNX classifier with labels and model card (`docs/TILE-MODEL.md`),
  trained on the plant's own images, with a dataset licence that permits commercial use.
- **LLM**: an `ANTHROPIC_API_KEY` under the company's agreement, a chosen `LLM__Model`, data-handling
  review (what plant data may be sent), cost limits and an evaluation set for the assistant.
- **Embeddings**: an `IEmbeddingProvider` implementation and key if semantic document search is wanted.
- **Documents**: the company's real procedures and manuals in the Knowledge Centre.

## Engineering and governance

- **Security**: independent security review and penetration test; SSO (e.g. Entra ID) instead of local
  accounts; HTTPS; secrets in a vault; hardened CORS/hosting; dependency scanning.
- **Maintenance rules**: the suggestion table and prioritisation weights (`docs/MAINTENANCE-RULES.md`)
  must be replaced or approved by the site's maintenance team.
- **Licensing**: QuestPDF Community licence is free only below its revenue threshold — check before
  adoption. Check every dataset licence (e.g. MVTec AD is non-commercial).
- **Operations**: deployment (containers / cloud), backups, monitoring and alerting, logging retention,
  multi-site support, load testing.
- **Human factors**: user acceptance testing with inspectors and engineers; training; a clear policy
  that suggestions require review by a qualified engineer and the system never controls equipment.
