Invoices CSV format

Required headers (exported by the app):
- id,client,amount,date,status,paidOn,paidAmount

Payments CSV format

Required headers (exported by the app):
- id,client,amount,date,invoiceId

Notes
- Fields are CSV-quoted when needed; imports accept quoted fields and commas inside quoted values.
- `id` may be omitted on import; an internal id will be assigned.
- `date` should be ISO format `YYYY-MM-DD`.
- `amount`, `paidAmount` should be numeric (decimal). If omitted they default to 0.

Examples

Invoices sample row:
"","Acme Inc","1200","2026-07-12","issued","",""

Payments sample row:
"","Acme Inc","1200","2026-07-20",""
