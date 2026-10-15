# Historical Academic Year Switcher & Multi-Year Data Browsing Plan

This plan details the architecture and implementation for switching between past and current academic years across all modules (Students, Classes, Attendance, Accounting/Fees, Exams, Results, and Reports) in read-only historical viewing mode.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed directly by the user:

- **Confirmed Decision 1 (Read-Only Mode for Past Years)**: Past academic years will operate strictly in **Read-Only Mode** ("শুধু দেখার অনুমতি থাকবে"). When a past academic year is selected, users can view all student records, attendance reports, exam results, and financial transactions for that year, but cannot add, edit, or delete data to prevent past year corruption.
- **Confirmed Decision 2 (Switching Location)**: Academic Year switching will take place inside the **Academic Year Module** ("শিক্ষাবর্ষ মডিউল যেখানে আছে সেখানেই থাকবে"). A persistent banner/badge will appear at the top of the interface showing the currently viewed academic year with a single click button to return to the active year.
- **Confirmed Decision 3 (Historical Class & Roll Accuracy)**: Students and class rosters for past academic years will be queried based on their class and roll for that specific year ("ওই শিক্ষাবর্ষে শিক্ষার্থীর তখনকার ক্লাস ও রোল অনুযায়ী").

---

## 1. Overview & Core Concept

Currently, switching or creating a new academic year overwrites active student records, leading to data mixing and loss of visibility into past academic years.

This solution introduces a **Global Academic Year Viewing Context** (`selectedYear`):
1. **Active Year** (`activeYear`): The institution's official active session where current daily operations (new admissions, daily attendance, fee collections, current exams) occur and save.
2. **Viewing Year** (`selectedYear`): The academic year selected by the user to view.
   - When `selectedYear.id === activeYear.id`: Standard read-write mode for current operations.
   - When `selectedYear.id !== activeYear.id`: **Read-Only Historical Mode**. All views automatically query data filtered by `selectedYear.id`. Edit and creation controls are suppressed, and a prominent banner reminds the user they are viewing historical records.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Viewing Past Academic Year**:
   - User goes to **Account -> Academic Year** (`AcademicYearManager`).
   - Clicks **"বিগত ডাটা দেখুন" (View Data)** on any archived academic year.
   - The app switches into Historical Viewing Mode for that year.
   - A soft banner appears at the top: `👁️ বিগত শিক্ষাবর্ষ: [২০২৪-২০২৫] (শুধু দেখা যাবে)` with a `[বর্তমান শিক্ষাবর্ষে ফিরুন]` button.
   - Navigating to Students, Classes, Attendance, Accounting, or Exam Result tabs shows complete historical records for that year.
   - Add/Edit buttons are disabled with tooltip `"বিগত শিক্ষাবর্ষের তথ্য কেবল দেখা যাবে"`.

2. **Returning to Current Active Year**:
   - Clicks `[বর্তমান শিক্ষাবর্ষে ফিরুন]` in the header banner or in the Academic Year Manager.
   - App returns to normal active state with full edit/create capabilities.

---

## 3. Technical Architecture & Component Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                          useAuth / AuthContext                         │
│   ┌────────────────────────┐         ┌─────────────────────────────┐   │
│   │ activeYear (Official)  │         │ selectedYear (Viewing Mode) │   │
│   └───────────┬────────────┘         └──────────────┬──────────────┘   │
└───────────────┼─────────────────────────────────────┼──────────────────┘
                │                                     │
                ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Header Banner                              │
│   [ 👁️ বিগত শিক্ষাবর্ষ: 2024 (Read Only) ]  -->  [ বর্তমান শিক্ষাবর্ষে ফিরুন ]│
└────────────────────────────────────────────────────────────────────────┘
                │
                ├──────────────────────┬──────────────────────┐
                ▼                      ▼                      ▼
┌──────────────────────┐┌──────────────────────┐┌──────────────────────┐
│  Students / Classes  ││ Attendance & Finance ││  Exams & Results     │
│ .eq('academic_year_  ││ .eq('academic_year_  ││ .eq('academic_year_  │
│      id', yearId)    ││      id', yearId)    ││      id', yearId)    │
│  readOnly = true     ││  readOnly = true     ││  readOnly = true     │
└──────────────────────┘└──────────────────────┘└──────────────────────┘
```

### Key Data Strategy

1. **`useAuth.ts` State**:
   - `activeYear`: AcademicYear object with `status = 'active'`.
   - `selectedYear`: AcademicYear object currently selected for viewing (persisted in `sessionStorage`).
   - `setSelectedYear`: Function to change viewing year.
   - `isHistoricalMode`: Computed `Boolean(selectedYear && activeYear && selectedYear.id !== activeYear.id)`.

2. **Query Filters in Modules**:
   - **`Students.tsx` / `Home.tsx`**: Filter students by `.eq('academic_year_id', selectedYear.id)` (or null for legacy data).
   - **`Attendance.tsx`**: Query attendance by `.eq('academic_year_id', selectedYear.id)`.
   - **`Accounting.tsx`**: Query ledger entries and fees by `.eq('academic_year_id', selectedYear.id)`.
   - **`Exams.tsx` & `FinalResults.tsx`**: Query exams and results by `.eq('academic_year_id', selectedYear.id)`.

3. **Academic Year Switcher in `AcademicYearManager.tsx`**:
   - Add an action button next to every academic year:
     - For Active Year: Badge `[সক্রিয় শিক্ষাবর্ষ]`
     - For Past Years: Button `[বিগত ডাটা দেখুন]` and `[সক্রিয় করুন]` (Activate).

---

## 4. Implementation Steps

1. **`useAuth.ts` Context Expansion**:
   - Expose `selectedYear`, `setSelectedYear`, and `isHistoricalMode`.
   - Initialize `selectedYear` from `sessionStorage` or fallback to `activeYear`.

2. **`AcademicYearManager.tsx` Updates**:
   - Add "View Past Year" / "বিগত ডাটা দেখুন" action.
   - Allow switching viewing context without altering the DB active status unless "Activate Year" is explicitly clicked.

3. **Global Layout Header Indicator (`Layout.tsx`)**:
   - Render persistent banner when `isHistoricalMode` is active.
   - Include one-click return to current year.

4. **Module Integration**:
   - Pass `selectedYear` and `readOnly={isHistoricalMode}` to `Students`, `Classes`, `Attendance`, `Accounting`, `Exams`, and `FinalResults`.
   - Update fetch queries to scope by `selectedYear.id`.

5. **Verification & Testing**:
   - Run `compile_applet` to ensure zero build or TypeScript errors.
