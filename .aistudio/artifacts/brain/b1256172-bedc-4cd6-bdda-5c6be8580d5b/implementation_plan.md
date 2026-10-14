# Deenora Next-Gen: Guardian Mobile PWA & Automated Smart Academic Remarks

Equip Deenora with a dedicated, installable Guardian Mobile Progressive Web App (PWA) featuring real-time Web Push notifications and an intelligent pedagogical evaluation engine that automatically generates personalized report card remarks and progress summaries.

### User Review & Critical Decisions

> [!IMPORTANT]
> WhatsApp integration has been removed from this release based on your explicit instructions. Development is focused entirely on the **Guardian Mobile PWA with Push Notifications** and the **Automated Smart Report Card Remarks Engine**.

- **Confirmed Decision 1 (Guardian Mobile PWA)**: A mobile-first, installable Web App experience tailored specifically for parents and guardians with intuitive bottom navigation, instant biometric/PIN access, offline caching, and real-time Web Push alerts for attendance, fee dues, and exam results.
- **Confirmed Decision 2 (Automated Smart Remarks)**: Multi-dimensional academic heuristics engine that analyzes student score trends, subject strengths, attendance consistency, and moral conduct/Adab to generate structured, personalized remarks in Bengali and English without repetitive teacher typing.
- **Confirmed Decision 3 (Scope Boundary)**: WhatsApp messaging is fully excluded from this milestone to keep infrastructure streamlined and cost-free.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. *Guardian Mobile PWA*: Provides parents with a native app-like experience directly from their smartphone browser without going through app stores. Includes home-screen installation, instant push alerts when their child is marked absent or fees are due, and quick access to digital report cards and daily diaries.
  2. *Smart Academic Remarks Engine*: Automatically computes student-specific diagnostic remarks for term report cards, highlighting individual academic strengths, subjects needing encouragement, and moral character assessments, with full teacher editing and override controls.
- **Target Audience / Persona**:
  - *Guardians / Parents*: Need immediate, hassle-free updates on mobile devices with zero login complexity.
  - *Teachers & Principals*: Need to prepare hundreds of meaningful, individualized report card evaluations in minutes rather than spending days writing repetitive comments manually.
- **Key Value**: Delivers instant school-to-home transparency for parents while saving madrasah and school educators over 80% of their exam evaluation time.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Guardian App Installation & Push Notification Flow*:
     - Guardian visits the student portal link (or scans a QR code from the ID card / diary).
     - A banner invites the parent to "Install Deenora Guardian App" with one tap.
     - A "Turn On Mobile Notifications" prompt registers device Web Push tokens for real-time alerts.
     - The bottom navigation bar provides instant one-touch switching between:
       - **Home**: Student summary, today's attendance badge, and recent announcements.
       - **Academic**: Exam marksheets, smart remarks, and progress charts.
       - **Finance**: Fee invoices, payment history, and instant digital receipts.
       - **Diary**: Daily homework, memorization (Hifz/Nazera) tasks, and teacher notes.
  2. *Teacher Smart Remarks Flow*:
     - In the Examination or Result Management module, the teacher views the class result sheet.
     - A new "Generate Smart Remarks" button processes the selected exam term.
     - The engine inspects GPA, subject grade distribution, attendance percentage, and moral conduct scores.
     - A preview table shows recommended Bengali and English comments (e.g., "মাশাআল্লাহ, গণিত ও আরবিতে বিশেষ পারদর্শিতা প্রদর্শন করেছে। তবে নিয়মিত উপস্থিতি ও বানানে বাড়তি যত্ন প্রয়োজন।").
     - The teacher can accept all suggestions, customize specific phrases, or edit inline before generating final PDF marksheets and syncing with the Guardian Portal.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Refined Islamic EdTech interface emphasizing clarity, serenity, and high legibility on mobile screens.
  - *Color Palette & Mood*:
    - Canvas: Clean white (`#FFFFFF`) with ultra-light slate background (`#F8FAFC`).
    - Primary Emerald: `#047857` and `#059669` representing knowledge, growth, and Islamic tradition.
    - Status Accents: Muted emerald (`#10B981`) for present/pass, warm amber (`#F59E0B`) for warnings/dues, soft rose (`#EF4444`) for absent/lagging.
    - Surfaces: Flat containers with delicate hairline borders (`border-slate-200 dark:border-slate-800`), strictly avoiding nested card clutter.
  - *Typography & Hierarchy*:
    - Display / Brand: `Plus Jakarta Sans` for English headings; `Hind Siliguri` for Bengali headings and student details.
    - Data Figures: Strict tabular numerals (`font-mono tabular-nums`) for marks, percentages, roll numbers, and currency.
    - Zero-Pill Discipline: All metadata (dates, terms, sections) rendered as clean unboxed text separated by subtle dots (`·`).

- **Interactive Feedback & Motion**:
  - Touch-friendly tap targets ($\ge 44\text{px}$) optimized for thumbs on mobile viewports.
  - Sub-150ms feedback on bottom navigation switches and filter toggles.
  - Smooth bottom sheet drawers for remark editing and notification preferences.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Progressive Web App (PWA) vs. Native Android APK**
  - *Chosen Approach*: Progressive Web App (PWA) with manifest, modern service worker caching, and Web Push API, compatible with standard Android WebViews and standalone mobile browsers.
  - *Why*: Instant distribution with zero installation barriers for parents, automatic background updates, and zero Play Store compliance overhead.
  - *Alternatives Considered*: Native store app rejected because it requires separate builds, manual store updates, and APK distribution headaches for guardians.
- **Decision 2: Rule-Based Pedagogical Engine vs. Cloud LLM for Remarks**
  - *Chosen Approach*: Deterministic pedagogical heuristics engine with localized Bengali and English phrasing templates categorized by achievement tiers, subject strengths, and growth areas.
  - *Why*: Guaranteed 100% reliability, instant zero-latency batch processing for 500+ students, zero API token costs, and culturally authentic Bengali phrasing without AI hallucinations.
  - *Alternatives Considered*: Cloud AI API calls rejected for batch generation due to latency, potential rate limits during exam peak seasons, and recurring subscription costs.
- **Decision 3: Device Notification Architecture**
  - *Chosen Approach*: Standard Web Push API using Service Worker notifications with browser permission management and local fallback badges.
  - *Why*: Works across Android Chrome, Samsung Internet, Edge, and iOS 16.4+ Safari home-screen apps without requiring third-party SDK dependencies.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             DEENORA PLATFORM                                │
├─────────────────────────────────────────┬───────────────────────────────────┤
│           Guardian Mobile PWA           │    Smart Remarks & Analytics      │
│  ┌───────────────────────────────────┐  │  ┌─────────────────────────────┐  │
│  │ Mobile Shell & Bottom Nav         │  │  │ Performance Tier Classifier │  │
│  │ Service Worker & Offline Cache    │  │  │ Subject Strength Detector   │  │
│  │ Web Push Notification Service     │  │  │ Attendance & Adab Correlator│  │
│  │ Touch Card Lists (Fees, Results)  │  │  │ Bengali / English Generator │  │
│  └─────────────────┬─────────────────┘  │  └──────────────┬──────────────┘  │
└────────────────────┼──────────────────────────────────────┼─────────────────┘
                     ▼                                      ▼
┌─────────────────────────────────────────┐ ┌─────────────────────────────────┐
│ Browser Cache & IndexedDB               │ │ Result Sheet & PDF Engine       │
│ Offline student records & sync status   │ │ Inlines remarks into marksheets │
└─────────────────────────────────────────┘ └─────────────────────────────────┘
```

- **Data Model & State Additions**:
  - `smart_remarks`: Structured entity linking `student_id`, `exam_id`, `academic_year_id`, `strengths`, `growth_areas`, `conduct_grade`, `generated_remark_bn`, `generated_remark_en`, and `teacher_customized_remark`.
  - `push_subscriptions`: Stores parent subscription credentials (`endpoint`, `keys`, `student_id`, `created_at`) for automated notification dispatch.
  - `guardian_sessions`: Quick-access authorization state allowing verified parents persistent access on their smartphones.

- **Interactive Component Mapping**:
  - `GuardianAppLayout`: Responsive viewport wrapper with mobile bottom bar, header alerts, and PWA install prompt.
  - `SmartRemarksModal`: Batch generator modal with rule customization (achievement cutoff, tone selector, Bengali/English switch).
  - `PushNotificationPrompt`: Permission request banner and notification settings toggle.
  - `FinalResultTemplate` & `ResultSheetTemplate`: Updated PDF generators to display the personalized smart remarks in the designated remarks box.
