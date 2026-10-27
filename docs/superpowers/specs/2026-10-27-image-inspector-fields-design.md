# Image Inspector Field Styling

## Goal

Make the Alt text and Link fields in the image inspector visually consistent with the Preheader input in Document Settings > Email Metadata.

## Design

Use the existing metadata field-row layout for the two image fields: a vertical label/input arrangement, full-width controls, 14px vertical and 18px horizontal padding, and an 8px gap. Keep the existing field labels, link prefix, values, and input event behavior unchanged. Limit the change to these two fields.

## Validation

Update the focused image inspector UI test to assert the intended field layout/padding, run that test, then run the production build.
