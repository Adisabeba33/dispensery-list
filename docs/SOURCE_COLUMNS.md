# Current OCM Licenses — source columns

Snapshot: `2026-09-04T09:16:19.670Z`
Dataset: `https://data.ny.gov/Economic-Development/Current-OCM-Licenses/jskf-tt3q`
Raw rows: **2958**

## Actual columns

| fieldName | Display name |
|---|---|
| `license_number` | License Number |
| `license_type` | License Type |
| `license_type_code` | License Type Code |
| `license_status` | License Status |
| `license_status_code` | License Status Code |
| `issued_date` | Issued Date |
| `effective_date` | Effective Date |
| `expiration_date` | Expiration Date |
| `application_number` | Application Number |
| `see_category` | SEE Category |
| `entity_name` | Entity Name |
| `dba` | DBA |
| `location_id` | Location ID |
| `address_line_1` | Address Line 1 |
| `address_line_2` | Address Line 2 |
| `city` | City |
| `state` | State |
| `zip_code` | Zip Code |
| `county` | County |
| `region` | Region |
| `business_website` | Business Website |
| `operational_status` | Operational Status |
| `business_purpose` | Business Purpose |
| `tier_type` | Tier Type |
| `processor_type` | Processor Type |
| `cultivation_indoor` | Cultivation Indoor |
| `cultivation_outdoor` | Cultivation Outdoor |
| `cultivation_mixed_light` | Cultivation Mixed Light |
| `cultivation_combination` | Cultivation Combination |
| `cultivation_activities_drying` | Cultivation Activities Drying Curing |
| `cultivation_activities_storage` | Cultivation Activities Storage |
| `cultivation_activities` | Cultivation Activities Packaging |
| `cultivation_activities_waste` | Cultivation Activities Waste Rendering |
| `processing_activities` | Processing Activities Extraction |
| `processing_activities_blending` | Processing Activities Blending and Infusing |
| `processing_activities_1` | Processing Activities Packaging and Labeling |
| `processing_activities_branding` | Processing Activities Branding |
| `retail_activities_sales_with` | Retail Activities Sales with Delivery |
| `retail_activities_sales_no` | Retail Activities Sales No Delivery |
| `retail_activities_non_cannabis` | Retail Activities Non-Cannabis Products |
| `retail_activities_drive_thru` | Retail Activities Drive Thru |
| `retail_date_opened_to_public` | Retail Date Opened to Public |
| `hours_of_operation` | Hours of Operation |
| `primary_contact_name` | Primary Contact Name |

## Filter used

1. County must be one of New York, Kings, Queens, Bronx, Richmond, Westchester.
2. License type must be Adult-Use Retail Dispensary, CAURD, or Microbusiness with an explicit retail business purpose.
3. `license_number` must satisfy the repository contract `OCM-...`; this removes proximity-protection applicants and also exposes a schema conflict for legacy Registered Organization IDs (`MM####D`).
4. Only current `Active` license rows are published in this phase. Expired rows are retained in the raw snapshot and enumerated in the report, not silently dropped.
5. ZIP sanity is applied after county filtering. Two official rows marked `county=New York` are physically upstate (Remsen 13438 and Palenville 12414); they are excluded as source-data geography anomalies.

## Operational status

`OPEN` is assigned only when a confident match exists on OCM's Dispensary Location Verification public-open list. Registry `Non-Operational` becomes `APPROVED_NOT_OPEN` unless the OCM public-open list overrides it. Registry `Active` without a confident public-open-list match is `UNKNOWN`, never guessed open.
