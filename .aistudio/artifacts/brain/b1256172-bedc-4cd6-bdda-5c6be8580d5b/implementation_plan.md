# Class-Wise Result System Configuration & Dynamic Routing

A flexible, class-level result engine architecture enabling educational institutions (Madrasahs and Schools) to assign specific grading systems—such as GPA/Grading, Befaq, or High School—on a per-class basis within the Exam & Result Settings panel, automatically launching the corresponding result engine interface upon entering each class.

> [!IMPORTANT]
> **Confirmed User Decisions (from Clarification Phase):**
> - **Settings Location**: The class-wise result system selection is housed directly within the **Exam & Result Settings Panel** (পরীক্ষা ও রেজাল্ট সেটিংস প্যানেল), accessible from the Exam management workspace.
> - **Allowed Systems by Institution Type**:
>   - **Madrasah**: জিপিএ (GPA/School Grading) and বেফাক (Befaq Examination System).
>   - **School**: জিপিএ (GPA System) and হাই স্কুল (High School Grading System).
> - **Navigation & Routing**: When entering a class from the exam class list, the system automatically routes to and launches the designated engine interface for that class (e.g., Befaq engine for Befaq classes, GPA engine for GPA classes).
> - **Average Mark Feature**: The Befaq mark entry table average mark column (গড় নম্বর) requested earlier is fully verified and integrated into the workflow.

---

## 1. Overview & Core Concept

### What It Does
This feature enables mixed-curriculum institutions to manage different educational standards within a single institution account. For example, a Madrasah may conduct primary/nursery classes using the standard GPA system while higher theological classes follow the Befaqul Madaris (বেফাক) examination structure. In schools, lower classes can use standard GPA while secondary grades follow the High School grading matrix.

Administrators can designate the result engine for each class in the Exam & Result Settings modal. When viewing exams, the class browser shows each class with its configured result system badge. Clicking a class automatically activates that class's specialized result engine interface with full marksheet, seat plan, admit card, and merit ranking support.

### Target Audience & Persona
- **Institution Administrators & Head Principals**: Need granular control over which classes follow board/befaq rules versus standard GPA without creating separate institution accounts.
- **Teachers & Evaluators**: Enter marks and view merit ranks inside the exact regulatory format required for that specific class.

### Key Value
Eliminates curriculum friction by allowing multi-stream madrasahs and schools to co-exist in one unified management platform with zero manual switching needed by teachers.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Configuring Class Result Systems**:
   - User navigates to **Exams** (পরীক্ষা).
   - In the header or settings bar, clicks the **Exam & Result Settings** (পরীক্ষা ও রেজাল্ট সেটিংস) gear button.
   - The settings modal opens with a dedicated section: **"ক্লাস অনুযায়ী রেজাল্ট সিস্টেম নির্ধারণ" (Class-wise Result System Settings)**.
   - A list of all active classes is displayed with sleek segmented toggle controls matching the institution type:
     - For Madrasah: `[ জিপিএ (GPA) | বেফাক (Befaq) ]`
     - For School: `[ জিপিএ (GPA) | হাই স্কুল (High School) ]`
   - Changing a toggle automatically updates the state and persists to the institution's `config_json.class_result_engines`.
   - Visual confirmation toast confirms instant save.

2. **Browsing Classes & Automatic Dynamic Interface**:
   - In the main Exams view (`activeTab === 'exams'`, `view === 'list'`), the class cards grid displays all classes.
   - Each card displays a clean typography tag indicating its active system (e.g. `বেফাক সিস্টেম` in emerald or `জিপিএ সিস্টেম` in blue).
   - When the user clicks on a class card:
     - If the class is set to `befaq`, it dynamically initializes and renders `BefaqResultEngine` scoped to that class.
     - If the class is set to `school` / `gpa` / `high_school`, it initializes `SchoolResultEngine` scoped to that class.
   - Clicking **"Back to Classes"** (শ্রেণিতে ফিরে যান) seamlessly unmounts the active class view and returns to the unified class list.

### Visual Identity & Theme
- **Color Palette & Discipline**:
  - Light canvas: Clean off-white (`#F8FAFC`) with pure white card surfaces (`#FFFFFF`) and hairline borders (`border-slate-200`).
  - Dark canvas: Deep navy/slate (`#0F172A`) with subdued elevated panels (`#1E293B`) and dark hairline borders (`border-slate-800`).
  - Engine Accents:
    - **Befaq System**: Distinctive emerald branding (`#059669` / `text-emerald-500`) with subtle mint indicator.
    - **GPA / School System**: Institutional royal blue (`#2563EB` / `text-blue-500`).
    - **High School System**: Indigo / Violet accent (`#4F46E5`).
- **Typography**:
  - Bengali prose: Clean `Hind Siliguri` / `Noto Sans Bengali` with refined weights (font-bold / font-black).
  - Tabular and score numbers: Strict `font-mono tabular-nums` for roll, marks, total, and average marks.
- **Anti-Slop Restraint**:
  - Zero static pill capsules around status text; metadata rendered as clean inline typographic text separated by `·`.
  - Filter controls and toggles built with functional segmented button controls.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Storage Architecture for Class-Wise Engine Mapping
- **Chosen Approach**: Store class engine mappings inside `institutions.config_json.class_result_engines` as a key-value dictionary (`{ [classId]: 'befaq' | 'gpa' | 'high_school' }`).
- **Why**: 
  - Works immediately with existing Supabase schema without requiring a database migration on the `classes` table.
  - Automatically syncs across devices when the institution profile updates.
  - Fallback logic is straightforward: if a class has no override in `class_result_engines`, it falls back to the institution default `institution.config_json.result_engine`.
- **Alternatives Considered**: Adding an `engine` column to `classes` table—rejected because it would require altering table schemas and backend RPCs across all environments.

### Decision 2: Routing Architecture in `Exams.tsx`
- **Chosen Approach**: Elevate the class selection stage to a unified coordinator component in `Exams.tsx`. When a class is selected, `ExamsContent` reads `class_result_engines[selectedClassId]` and mounts the matching engine (`BefaqResultEngine` or `SchoolResultEngine`) pre-initialized with `selectedClassId`.
- **Why**: 
  - Prevents state collision and duplicate network fetches between engines.
  - Ensures a seamless transition: clicking a Befaq class shows Befaq's specific Marhala/Sanad views, while clicking a School class shows standard GPA subject grading.
  - Teachers only see the interface relevant to their students.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Exams.tsx                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Unified Top Bar: Search · Exam Settings Modal Trigger (Settings) │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                   │                                    │
│                 ┌─────────────────┴─────────────────┐                  │
│                 ▼                                   ▼                  │
│       [No Class Selected]                 [Class Selected: ID]         │
│  ┌──────────────────────────────┐                   │                  │
│  │     Class Cards Grid         │                   │                  │
│  │ • Class 1 [জিপিএ সিস্টেম]    │                   │                  │
│  │ • Class 2 [বেফাক সিস্টেম]    │                   │                  │
│  │ • Class 3 [হাই স্কুল]        │                   │                  │
│  └──────────────────────────────┘                   │                  │
│                 │                                   │                  │
│                 ▼                                   ▼                  │
│      [Exam Settings Modal]                Check class engine:          │
│   ┌─────────────────────────┐             ┌─────────────────┐          │
│   │ Class Engine Selectors: │             │ engine ===      │          │
│   │ [Class A] -> [GPA|Befaq]│             │ 'befaq' ?       │          │
│   │ [Class B] -> [GPA|Befaq]│             └────────┬────────┘          │
│   │ Instant DB Save         │                      │                   │
│   └─────────────────────────┘             ┌────────┴────────┐          │
│                                           ▼                 ▼          │
│                                  BefaqResultEngine   SchoolResultEngine │
│                                  (Befaq UI & Logic)  (GPA/School Logic) │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Schema

```typescript
// Extension to Institution config_json:
interface InstitutionConfig {
  result_engine?: 'school' | 'befaq' | 'qawmi_custom';
  class_result_engines?: Record<string, 'gpa' | 'befaq' | 'high_school' | 'school'>;
  merit_ranking_mode?: string;
  // ... existing fields preserved
}
```

### Interactive State Transitions

1. **Settings Modal Toggle**:
   - `handleToggleClassEngine(classId: string, engine: 'gpa' | 'befaq' | 'high_school')`
   - Immutably clones `madrasah.config_json.class_result_engines`.
   - Calls Supabase `institutions.update({ config_json })`.
   - Updates local React state so UI reflects the new choice immediately.

2. **Dynamic Class Selection**:
   - When user clicks a class in `Exams.tsx`:
     `const targetEngine = madrasah?.config_json?.class_result_engines?.[cls.id] || madrasah?.config_json?.result_engine || 'school';`
   - Sets `selectedClassId = cls.id` and `activeEngine = targetEngine`.
   - Renders the chosen engine with `initialClassId={cls.id}` and `onBack={() => setSelectedClassId(null)}`.
