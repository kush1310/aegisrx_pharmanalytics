# Google Stitch AI - UI Mockup Generation Prompts

## Overview

These prompts are designed for Google Stitch AI to generate desktop application UI mockups for a pharmaceutical analytics software. The design should be **minimal, clean, and suitable for non-technical users**.

---

## 🎨 Global Design Guidelines for All Prompts

**Include these specifications in every prompt:**

```
Design Style:
- Desktop application (Windows software), NOT a website
- Clean, minimal UI with ample white space
- Primary color: #2563EB (Blue)
- Secondary color: #10B981 (Green)
- Background: Pure white (#FFFFFF)
- Cards/Surfaces: Light gray (#F3F4F6)
- Text: Dark gray (#1F2937)
- Font: Clean sans-serif (like Inter or Segoe UI)
- Rounded corners (8px radius)
- Subtle shadows on cards
- NO device frames (no laptop/monitor bezels)
- Resolution: 1920x1080 desktop layout
- Left sidebar navigation pattern
```

---

## Prompt 1: Main Dashboard

```
Create a desktop application main dashboard screen for a pharmaceutical analytics software.

Layout:
- Left sidebar (200px wide, light gray background) with:
  - App logo placeholder at top
  - Navigation items: Dashboard (active, blue highlight), Doctors, Hospitals, Pharmacies
  - Notification bell icon at bottom

- Main content area:
  - Top header bar with app title "SuratPharma Analytics"
  - Three large statistics cards in a row:
    - Card 1: Doctor icon, "125" count, "Doctors" label
    - Card 2: Hospital icon, "48" count, "Hospitals" label
    - Card 3: Pharmacy icon, "312" count, "Pharmacy Stores" label
  - Below cards: Excel upload zone (dashed border rectangle with upload icon and "Drop Excel file here or click to browse" text)
  - Analytics section with two charts side by side:
    - Left: Vertical bar chart showing "Top 10 Doctors by Revenue"
    - Right: Pie chart showing "Revenue by Pharmacy"
  - Bottom section: "History" list showing 3 uploaded Excel files with dates and delete icons

Style: Clean, minimal, professional. Blue accents. White background. Suitable for non-tech business owner.
```

---

## Prompt 2: Doctor List View

```
Create a desktop application screen showing a list of doctors.

Layout:
- Left sidebar (same as dashboard, with "Doctors" item now active/highlighted)
- Main content:
  - Header: "Doctors" title, blue "+ Add Doctor" button on right
  - Search bar with magnifying glass icon
  - Grid/list of doctor cards (show 4-6 doctors):
    Each card contains:
    - Avatar placeholder (circle with doctor icon)
    - Doctor name in bold (e.g., "Dr. Amit Trivedi")
    - Specialization below (e.g., "Orthopedic Surgeon")
    - Contact number with phone icon
    - Location with pin icon
    - Small text "Happy Clinic + 7 hospitals"
    - Edit (pencil) and Delete (trash) icon buttons on right
  - Pagination at bottom: "Showing 1-10 of 125" with page numbers

Style: Card-based layout, white cards on light gray background, subtle shadows, professional medical software aesthetic.
```

---

## Prompt 3: Add Doctor Wizard - Step 1

```
Create a modal/popup dialog for adding a new doctor - Step 1 of 3.

Layout:
- Centered modal (600px wide) with white background and shadow
- Header: "Add New Doctor" title, X close button on right
- Progress indicator showing Step 1 active (3 connected dots/steps)
- Form fields:
  - "Full Name" label + text input with asterisk (required)
  - "Contact Number" label + text input with +91 prefix
  - "Address" label + larger textarea input
- Footer: "Cancel" button (gray outline) and "Next →" button (blue filled)

Style: Clean form design, clear labels, generous spacing, blue accent on active step and primary button.
```

---

## Prompt 4: Add Doctor Wizard - Step 2 (Personal Details)

```
Create a modal/popup dialog for adding a new doctor - Step 2 of 3 (Personal Details, Optional).

Layout:
- Same modal frame as Step 1
- Header: "Add New Doctor" with subtitle "Step 2 of 3: Personal Details (Optional)"
- Progress indicator showing Step 2 active
- Form fields:
  - "Date of Birth" with calendar date picker
  - "Marital Status" with radio buttons: Single / Married
  - Conditional section (visible when Married selected):
    - "Spouse Name" text input
    - "Anniversary Date" date picker
    - "Number of Children" with number stepper (minus/plus buttons)
    - Dynamic text inputs for "Child 1 Name", "Child 2 Name" etc.
- Footer: "← Back" button, "Skip" button (gray), "Next →" button (blue)

Style: Show the married state with the conditional fields visible. Form should feel optional/relaxed.
```

---

## Prompt 5: Add Doctor Wizard - Step 3 (Professional)

```
Create a modal/popup dialog for adding a new doctor - Step 3 of 3 (Professional Details).

Layout:
- Same modal frame
- Header: "Add New Doctor" with subtitle "Step 3 of 3: Professional Details"
- Progress indicator showing Step 3 active (final step)
- Form fields:
  - "Qualification" dropdown (MBBS, MD, MS, etc.) with asterisk
  - "Specialization" dropdown with asterisk
  - Quick-select chips below for common specializations:
    [Orthopedic] [Cardiologist] [Neurologist] [Pediatrician]
    [Dermatologist] [ENT] [Ophthalmologist] [General Physician]
- Footer: "← Back" button, "Save Doctor ✓" button (green)

Style: Professional completion step, green save button indicates success action.
```

---

## Prompt 6: Doctor Profile Detail View

```
Create a doctor profile detail page in a desktop application.

Layout:
- Left sidebar (Doctors active)
- Main content:
  - Back arrow with "Back to Doctors" text
  - Profile header section:
    - Large avatar circle with doctor icon
    - Doctor name large: "Dr. Amit Trivedi"
    - Specialization: "Orthopedic Surgeon"
    - Qualification: "MBBS, MS (Ortho)"
    - Contact, Address, Birthday, Marriage info with icons
    - Edit and Delete buttons top right
  - Tab navigation: [Profile] [Linked Hospitals] [Revenue Analytics]
  - "Linked Hospitals" tab active showing:
    - "+ Link Hospital" button
    - List of 3 hospital cards:
      - Hospital name, address
      - Badge: "OWNER" (green) or "VISITING" (blue)
      - "Nearby Pharmacies: MedPlus, Apollo, HealthMart" text

Style: Clean profile layout, tabbed interface, relationship badges.
```

---

## Prompt 7: Hospital List and Add Hospital Form

```
Create a hospital management screen with a list and add form modal.

Main Screen Layout:
- Left sidebar (Hospitals active)
- Header: "Hospitals" title, "+ Add Hospital" button
- Search bar
- Grid of hospital cards (4 hospitals):
  - Hospital icon
  - Hospital name bold
  - Address
  - Phone numbers
  - "12 doctors linked" text
  - Edit/Delete icons

Modal (shown overlaid/semi-transparent):
- "Add New Hospital" header
- Single-step form:
  - Hospital/Clinic Name (required)
  - Address (required)
  - Primary Contact Number (required)
  - Secondary Contact Number
  - Reception Number
- Cancel and "Save Hospital ✓" buttons

Style: Show both the list view and modal together, modal slightly transparent background behind it.
```

---

## Prompt 8: Pharmacy Profile with Nearby Hospitals

```
Create a pharmacy profile detail page.

Layout:
- Left sidebar (Pharmacies active)
- Main content:
  - Back navigation
  - Pharmacy header:
    - Pharmacy icon
    - "MedPlus Pharmacy" name
    - Owner: "Mr. Rajesh Patel"
    - License ID, GST Number
    - Address, Contact
    - Edit/Delete buttons
  - Section: "Nearby Linked Hospitals" with "+ Link Hospital" button
  - List of 3 hospital cards with distance shown (e.g., "0.5 km away")
  - Section: "Connected Doctors (via Hospitals)" showing doctor avatars/names

Style: Relationship visualization, showing the pharmacy-hospital-doctor chain.
```

---

## Prompt 9: Analytics Dashboard with Charts

```
Create an analytics dashboard section after Excel upload.

Layout:
- Main dashboard area (no sidebar needed, focus on analytics):
  - Header: "Analytics Report - January 2026"
  - Date range display: "Jan 1, 2026 - Jan 31, 2026"
  - Row of KPI cards:
    - Total Revenue: ₹45,00,000
    - Active Doctors: 85
    - Active Pharmacies: 156
  - Two charts side by side:
    - Left: Horizontal bar chart "Top 10 Revenue Generating Doctors"
      Show bars with doctor names and amounts (₹30L, ₹25L, etc.)
    - Right: Pie chart "Revenue Distribution by Pharmacy"
      Show 5-6 colored segments with legend
  - Below: Detailed table showing:
    Doctor Name | Total Revenue | Top Pharmacy | Pharmacy Revenue Breakdown
    With expandable rows showing pharmacy details
  - Download buttons: [Weekly] [Monthly] [Quarterly] [Custom Date]

Style: Data-rich but not cluttered, professional analytics aesthetic, use blue/green colors for charts.
```

---

## Prompt 10: Report Download Section

```
Create a report export section for downloading analytics.

Layout:
- Clean white card/section
- Header: "Download Analytics Report" with PDF icon
- Description text: "Generate comprehensive PDF reports for selected time periods"
- Button row:
  - "Weekly Report" button (outline)
  - "Monthly Report" button (outline)
  - "3 Month Report" button (outline)
  - "6 Month Report" button (outline)
  - "Yearly Report" button (outline)
  - "Custom Range" button (filled blue)
- Custom date picker section (visible when Custom selected):
  - Start Date picker
  - End Date picker
  - "Generate Report" button (green)
- Progress indicator: "Generating report... 45%" with progress bar
- Success state: Green checkmark "Report ready!" with "Download" button

Style: Clean action buttons, clear visual hierarchy, progress feedback.
```

---

## Prompt 11: Notification Center

```
Create a notification center dropdown/panel.

Layout:
- Floating panel (350px wide) appearing from notification bell in header
- Header: "Notifications" with bell icon, "Mark all read" link
- Grouped sections:
  - "TODAY" label
    - Birthday notification card: 🎂 icon, "Dr. Amit Trivedi's Birthday Today!", phone number below, timestamp
  - "THIS WEEK" label
    - Anniversary notification: 💒 icon, "Dr. Priya Shah's Anniversary on Feb 12"
    - Birthday notification: 🎂 icon, "MedPlus Pharmacy Owner Birthday on Feb 14"
- Each notification:
  - Icon (birthday cake or rings)
  - Title text
  - Subtitle/details
  - Unread indicator (blue dot)
- Empty state alternative: "No upcoming events" with calendar icon

Style: Clean card-based notifications, celebratory icons, clear date grouping.
```

---

## Prompt 12: History Panel with Uploaded Files

```
Create a history section showing uploaded Excel files.

Layout:
- Section header: "Upload History" with clock icon
- Subtitle: "Previously analyzed Excel files"
- List of history items (show 5):
  Each item row:
  - Excel file icon
  - File name: "Sales_January_2026.xlsx"
  - Upload date: "Uploaded on Jan 15, 2026"
  - Record count: "2,450 records"
  - Status badge: "Processed" (green)
  - View button (eye icon)
  - Delete button (trash icon, red on hover)
- Hover state: Row highlights slightly
- Empty state: "No files uploaded yet. Upload your first Excel file above."

Style: File list aesthetic, clear actions, subtle interaction states.
```

---

## Prompt 13: Search Results with Fuzzy Matching

```
Create a search results dropdown showing fuzzy search matches.

Layout:
- Search input at top with "Dr. Ami" typed
- Dropdown panel below showing real-time results:
  - Section: "Doctors (3 results)"
    - Result 1: Avatar, "Dr. **Ami**t Trivedi" (matched text bold), Orthopedic
    - Result 2: "Dr. **Ami**ta Shah", Cardiologist
    - Result 3: "Dr. K**ami**ni Patel", Pediatrician
  - Section: "Hospitals (1 result)"
    - "**Ami** Care Hospital", Adajan
  - Keyboard hint at bottom: "↑↓ to navigate, Enter to select"
- Highlight on first result (selected state)

Style: Autocomplete dropdown aesthetic, matched text highlighted, grouped by entity type.
```

---

## 📋 Usage Instructions for Stitch AI

1. **Copy the Global Design Guidelines** at the top of each prompt
2. **Use one prompt at a time** for focused generation
3. **Iterate**: If the result isn't perfect, add clarifying details
4. **Request variations**: Ask for "same layout but with darker sidebar" etc.
5. **Export as PNG** at 1920x1080 for consistency

---

## 🎯 Priority Order for Generation

1. Main Dashboard (Prompt 1) - Most important, sets the tone
2. Doctor List View (Prompt 2) - Core functionality
3. Add Doctor Wizard Steps (Prompts 3-5) - Key user flow
4. Analytics Dashboard (Prompt 9) - Value demonstration
5. Remaining screens as needed

---

_Created for SuratPharma Analytics Desktop Application_
_February 2026_
