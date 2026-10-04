import { getSupabaseAdmin } from '../lib/supabase-admin.js';

/**
 * 22 Tool declarations in Gemini function calling schema format
 */
export const AGENT_TOOLS_DECLARATIONS = [
  // 4.1 Students
  {
    name: 'search_students',
    description: 'Search students by name, phone, roll or admission ID within the institute. Always use this first to resolve a student_id before any student-specific action.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Name, phone number, roll or admission ID' },
        class: { type: 'STRING', description: "Class/grade, e.g. '8', '10'" },
        section: { type: 'STRING', description: "Section, e.g. 'A', 'B'" }
      },
      required: ['query']
    }
  },
  {
    name: 'get_student',
    description: 'Get full profile of one student: personal info, class/section/roll, guardian contacts, status, and current fee dues summary.',
    parameters: {
      type: 'OBJECT',
      properties: {
        student_id: { type: 'STRING', description: 'Student ID from search_students' }
      },
      required: ['student_id']
    }
  },
  {
    name: 'create_student',
    description: 'Admit a new student to the institute.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Full name of the student' },
        class: { type: 'STRING', description: "Class/grade, e.g. '8'" },
        section: { type: 'STRING', description: 'Section name if applicable' },
        roll: { type: 'STRING', description: 'Class roll number' },
        guardian_name: { type: 'STRING', description: 'Father or Guardian name' },
        guardian_phone: { type: 'STRING', description: 'Guardian mobile phone number' },
        address: { type: 'STRING', description: 'Residential address' },
        admission_date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' }
      },
      required: ['name', 'class']
    }
  },
  {
    name: 'update_student',
    description: "Update a student's info (class, section, roll, guardian phone, address, status). Only include fields that need to change.",
    parameters: {
      type: 'OBJECT',
      properties: {
        student_id: { type: 'STRING', description: 'Student ID' },
        name: { type: 'STRING' },
        class: { type: 'STRING' },
        section: { type: 'STRING' },
        roll: { type: 'STRING' },
        guardian_name: { type: 'STRING' },
        guardian_phone: { type: 'STRING' },
        address: { type: 'STRING' },
        status: { type: 'STRING', description: 'active, inactive, or graduated' }
      },
      required: ['student_id']
    }
  },
  {
    name: 'delete_student',
    description: 'Permanently delete a student record. DANGEROUS — only call after the admin explicitly confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        student_id: { type: 'STRING' },
        reason: { type: 'STRING' }
      },
      required: ['student_id']
    }
  },

  // 4.2 Fees & Accounts
  {
    name: 'record_fee_payment',
    description: 'Record a fee payment received from a student. Money operation — only call after the admin explicitly confirms the amount and student.',
    parameters: {
      type: 'OBJECT',
      properties: {
        student_id: { type: 'STRING' },
        amount: { type: 'NUMBER', description: 'Amount in BDT' },
        fee_head: { type: 'STRING', description: "e.g. 'মাসিক বেতন', 'ভর্তি ফি', 'পরীক্ষার ফি'" },
        month: { type: 'STRING', description: "e.g. '2026-10', for monthly fees" },
        payment_method: { type: 'STRING', description: 'cash, bkash, nagad, rocket, or bank' },
        note: { type: 'STRING' }
      },
      required: ['student_id', 'amount']
    }
  },
  {
    name: 'get_fee_dues',
    description: 'List unpaid fee dues. Filter by class, section, student, or month.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class: { type: 'STRING' },
        section: { type: 'STRING' },
        student_id: { type: 'STRING' },
        month: { type: 'STRING', description: "e.g. '2026-10'" }
      }
    }
  },
  {
    name: 'create_fee_head',
    description: 'Create a new fee structure/head for the institution. MUST collect all 4 required parameters before executing: name, default_amount, applicable_class, frequency. Do NOT execute if any parameter is missing — ask the user for the remaining missing fields.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "Fee head name, e.g. 'মাসিক বেতন', 'ভর্তি ফি', 'পরীক্ষার ফি'" },
        default_amount: { type: 'NUMBER', description: 'Amount in BDT, e.g. 500' },
        applicable_class: { type: 'STRING', description: "Class name this fee applies to, or 'সকল শ্রেণি'" },
        frequency: { type: 'STRING', description: "Frequency e.g. 'মাসিক', 'এককালীন', 'বার্ষিক'" }
      },
      required: ['name', 'default_amount', 'applicable_class', 'frequency']
    }
  },
  {
    name: 'get_fee_collection_report',
    description: 'Fee collection summary for a date range: total collected, total due, number of payments.',
    parameters: {
      type: 'OBJECT',
      properties: {
        from_date: { type: 'STRING', description: 'YYYY-MM-DD' },
        to_date: { type: 'STRING', description: 'YYYY-MM-DD' },
        class: { type: 'STRING' }
      },
      required: ['from_date', 'to_date']
    }
  },

  // 4.3 Attendance
  {
    name: 'mark_attendance',
    description: 'Mark attendance for a class on a date. Provide one record per student.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class: { type: 'STRING' },
        section: { type: 'STRING' },
        date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' },
        records: {
          type: 'ARRAY',
          description: 'One entry per student',
          items: {
            type: 'OBJECT',
            properties: {
              student_id: { type: 'STRING' },
              status: { type: 'STRING', description: 'present, absent, late, or leave' }
            },
            required: ['student_id', 'status']
          }
        }
      },
      required: ['class', 'records']
    }
  },
  {
    name: 'get_attendance_summary',
    description: 'Attendance summary for a class over a date range: per-student present percentage and total present/absent counts.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class: { type: 'STRING' },
        section: { type: 'STRING' },
        from_date: { type: 'STRING', description: 'YYYY-MM-DD' },
        to_date: { type: 'STRING', description: 'YYYY-MM-DD' }
      },
      required: ['class', 'from_date', 'to_date']
    }
  },

  // 4.4 Exam & Result
  {
    name: 'create_exam',
    description: 'Create a new exam for the institution. MUST collect all 4 required parameters before executing: name, class, start_date, subjects. Do NOT execute if any parameter is missing — ask the user for the remaining missing fields.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "e.g. 'বার্ষিক পরীক্ষা ২০২৬', '১ম সাময়িক পরীক্ষা'" },
        class: { type: 'STRING', description: "Specific class name, or 'সকল শ্রেণি'" },
        start_date: { type: 'STRING', description: 'Exam date YYYY-MM-DD' },
        end_date: { type: 'STRING', description: 'YYYY-MM-DD (optional)' },
        subjects: { type: 'ARRAY', items: { type: 'STRING' }, description: "e.g. ['বাংলা', 'ইংরেজি', 'গণিত']" }
      },
      required: ['name', 'class', 'start_date', 'subjects']
    }
  },
  {
    name: 'list_exams',
    description: 'List recent exams with their names, dates, classes and publish status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class: { type: 'STRING', description: 'Optional class name to filter by' }
      }
    }
  },
  {
    name: 'record_marks',
    description: 'Record marks for one subject of an exam, one entry per student.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exam_id: { type: 'STRING' },
        subject: { type: 'STRING' },
        records: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              student_id: { type: 'STRING' },
              marks_obtained: { type: 'NUMBER' },
              total_marks: { type: 'NUMBER' }
            },
            required: ['student_id', 'marks_obtained']
          }
        }
      },
      required: ['exam_id', 'subject', 'records']
    }
  },
  {
    name: 'get_merit_list',
    description: 'Get the merit/result list of an exam: students ranked by total marks with GPA/grade if available.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exam_id: { type: 'STRING' },
        class: { type: 'STRING' },
        top_n: { type: 'NUMBER', description: 'e.g. 10 for top 10' }
      },
      required: ['exam_id']
    }
  },
  {
    name: 'publish_result',
    description: 'Publish an exam result so students/guardians can see it. Only call after the admin explicitly confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        exam_id: { type: 'STRING' }
      },
      required: ['exam_id']
    }
  },

  // 4.5 Notices
  {
    name: 'create_notice',
    description: 'Create and optionally publish a notice/announcement.',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING' },
        body: { type: 'STRING' },
        audience: { type: 'STRING', description: 'all_students, all_staff, everyone, or specific_class' },
        class: { type: 'STRING', description: 'Required when audience is specific_class' },
        publish_now: { type: 'BOOLEAN', description: 'Publish immediately; false saves as draft' }
      },
      required: ['title', 'body', 'audience']
    }
  },
  {
    name: 'update_notice',
    description: "Edit an existing notice's title, body, or audience.",
    parameters: {
      type: 'OBJECT',
      properties: {
        notice_id: { type: 'STRING' },
        title: { type: 'STRING' },
        body: { type: 'STRING' },
        audience: { type: 'STRING' }
      },
      required: ['notice_id']
    }
  },
  {
    name: 'delete_notice',
    description: 'Delete a notice. Only call after the admin explicitly confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        notice_id: { type: 'STRING' }
      },
      required: ['notice_id']
    }
  },
  {
    name: 'list_notices',
    description: 'List recent notices with their IDs, titles, audience and publish status.',
    parameters: {
      type: 'OBJECT',
      properties: {
        limit: { type: 'NUMBER', description: 'Defaults to 10' },
        audience: { type: 'STRING' }
      }
    }
  },

  // 4.6 Staff
  {
    name: 'list_staff',
    description: 'List staff members with IDs, names, roles and status. Use to resolve a staff_id.',
    parameters: {
      type: 'OBJECT',
      properties: {
        role: { type: 'STRING', description: 'e.g. teacher, accountant' },
        status: { type: 'STRING', description: 'active or inactive' }
      }
    }
  },
  {
    name: 'create_staff',
    description: 'Add a new teacher or staff member.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING' },
        role: { type: 'STRING', description: 'e.g. teacher, accountant, librarian' },
        phone: { type: 'STRING' },
        subject: { type: 'STRING', description: 'For teachers: main subject' },
        salary: { type: 'NUMBER', description: 'Monthly salary in BDT' },
        join_date: { type: 'STRING', description: 'YYYY-MM-DD, defaults to today' }
      },
      required: ['name', 'role']
    }
  },
  {
    name: 'update_staff',
    description: "Update a staff member's info. Only include fields that need to change.",
    parameters: {
      type: 'OBJECT',
      properties: {
        staff_id: { type: 'STRING' },
        name: { type: 'STRING' },
        role: { type: 'STRING' },
        phone: { type: 'STRING' },
        salary: { type: 'NUMBER' },
        status: { type: 'STRING', description: 'active or inactive' }
      },
      required: ['staff_id']
    }
  },

  // 4.7 Academic Classes
  {
    name: 'create_class',
    description: 'Create a new class / grade for the institution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "e.g. 'দশম শ্রেণি', 'হিফয বিভাগ', 'প্লে'" },
        sort_order: { type: 'NUMBER', description: 'Serial or sort order number, e.g. 1, 2, 10' }
      },
      required: ['name']
    }
  },
  {
    name: 'list_classes',
    description: 'List all academic classes of the institution with their IDs, names, sort orders, and student counts.',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'delete_class',
    description: 'Delete an academic class. Only call after admin explicitly confirms.',
    parameters: {
      type: 'OBJECT',
      properties: {
        class_id: { type: 'STRING' }
      },
      required: ['class_id']
    }
  },

  // 4.8 Super Admin & System Management Tools
  {
    name: 'create_institution',
    description: 'Super Admin tool ONLY: Create a new madrasah/school account in Deenora. Required parameters: name, phone, email, institution_code. If institution_code is unknown or missing, MUST ask the user if they have a custom code or want an auto-generated code (or pass "auto"). Restricted to Super Admin / Manager.',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: "Institute / Madrasah Name, e.g. 'মদিনাতুল কোরআন মাদ্রাসা'" },
        phone: { type: 'STRING', description: "Admin mobile number, e.g. '01774426477'" },
        email: { type: 'STRING', description: "Admin login email, e.g. 'mdalaminmia7835@gmail.com'" },
        institution_code: { type: 'STRING', description: "Institution Code e.g. 'M-1024' or 'auto'" },
        password: { type: 'STRING', description: "Admin login password, defaults to '123456' if omitted" },
        address: { type: 'STRING', description: "Full address, e.g. 'রামজীবন সুন্দরগঞ্জ গাইবান্ধা'" },
        package: { type: 'STRING', description: "Package name or number, e.g. 'প্যাকেজ ২', 'package_2'" },
        student_limit: { type: 'NUMBER', description: "Max student limit, defaults to 200 if omitted" },
        payment_type: { type: 'STRING', description: "Payment type, e.g. 'Monthly', 'Yearly'" },
        academic_year_start: { type: 'STRING', description: "Academic year start date YYYY-MM-DD" },
        institution_type: { type: 'STRING', description: "Type: 'madrasah', 'school', or 'college'" }
      },
      required: ['name', 'phone', 'email', 'institution_code']
    }
  },
  {
    name: 'list_institutions',
    description: 'Super Admin tool: List institutions/madrasahs in the system with their status, balance, phone, email, and type.',
    parameters: {
      type: 'OBJECT',
      properties: {
        search: { type: 'STRING', description: 'Search query by name, phone, or email' },
        status: { type: 'STRING', description: "Status filter e.g. 'active', 'suspended', 'inactive'" }
      }
    }
  },
  {
    name: 'update_institution_status',
    description: 'Super Admin tool: Update status, active flag, or balance of an institution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        institution_id: { type: 'STRING', description: 'Institution ID or Name' },
        status: { type: 'STRING', description: "Status: 'active', 'suspended', or 'inactive'" },
        is_active: { type: 'BOOLEAN' },
        balance: { type: 'NUMBER' }
      },
      required: ['institution_id']
    }
  },
  {
    name: 'get_superadmin_stats',
    description: 'Super Admin tool: View global system platform statistics (total institutions, total students, total active users, global balances).',
    parameters: {
      type: 'OBJECT',
      properties: {}
    }
  },
  {
    name: 'recharge_institution_balance',
    description: 'Super Admin tool: Recharge balance / SMS credits for a specific institution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        institution_id: { type: 'STRING', description: 'Institution ID or Name' },
        amount: { type: 'NUMBER', description: 'Recharge amount in BDT' },
        remarks: { type: 'STRING', description: 'Transaction note' }
      },
      required: ['institution_id', 'amount']
    }
  },
  {
    name: 'get_institution_transactions',
    description: 'Super Admin tool: Get recent transactions/recharge history for an institution.',
    parameters: {
      type: 'OBJECT',
      properties: {
        institution_id: { type: 'STRING', description: 'Institution ID, Code or Name' },
        limit: { type: 'NUMBER', description: 'Defaults to 10' }
      },
      required: ['institution_id']
    }
  }
];

export const CONFIRM_REQUIRED_TOOLS = new Set([
  'delete_student',
  'delete_notice',
  'delete_class',
  'record_fee_payment',
  'publish_result'
]);

/**
 * Builds the official Bangla System Prompt with session placeholders
 */
export function buildAgentSystemPrompt(options: {
  instituteName: string;
  adminName: string;
  currentDateStr: string;
}): string {
  return `তুমি Deenora-এর AI সহকারী। তুমি ${options.instituteName}-এর admin (${options.adminName})-কে প্রতিষ্ঠান পরিচালনার কাজে সাহায্য করো — ছাত্র ভর্তি/তথ্য, ফি আদায়/ফি সেটিং, হাজিরা, পরীক্ষার নম্বর ও রেজাল্ট, নোটিশ এবং স্টাফ সংক্রান্ত কাজ তোমার tools ব্যবহার করে দ্রুত ও দক্ষতার সাথে সম্পন্ন করো।

আজকের তারিখ: ${options.currentDateStr} (timezone: Asia/Dhaka)। টাকার অঙ্ক সবসময় টাকায় (BDT)।

## কঠোর নির্দেশিকা ও আচরণবিধি

0. **প্রতিষ্ঠানের নাম ও পরিচয় (Institute Identification Knowledge):**
   - তুমি যে প্রতিষ্ঠানের জন্য কাজ করছো তার নাম: **${options.instituteName}**।
   - অ্যাডমিন বা ইউজার যদি জিজ্ঞেস করে "আমার প্রতিষ্ঠানের নাম কি?" বা "আমার মাদ্রাসার নাম কি?", তুমি সরাসরি ও স্পষ্টভাবে বলবে: "আপনার প্রতিষ্ঠানের নাম **${options.instituteName}**।"
   - কখনোই বলবে না যে প্রতিষ্ঠানের নাম জানো না বা অ্যাক্সেস করতে পারছো না!

1. **পরীক্ষা, ফি সেটিং ও নতুন এন্ট্রি তৈরিতে সকল তথ্য সংগ্রহ বাধ্যতামূলক (Mandatory Information Collection):**
   - **পরীক্ষা তৈরি ('create_exam'):** ১. পরীক্ষার নাম, ২. শ্রেণি/ক্লাস (নির্দিষ্ট শ্রেণি বা 'সকল শ্রেণি'), ৩. পরীক্ষা শুরুর তারিখ, এবং ৪. বিষয়সমূহের তালিকা (কমপক্ষে ১ বা একাধিক বিষয়) — এই ৪টি তথ্যই আবশ্যিক।
   - **ফি সেটিং তৈরি ('create_fee_head'):** ১. ফি খাতের নাম, ২. টাকার পরিমাণ, ৩. প্রযোজ্য শ্রেণি (নির্দিষ্ট শ্রেণি বা 'সকল শ্রেণি'), এবং ৪. জমার ধরন/ফ্রিকোয়েন্সি (মাসিক/এককালীন/বার্ষিক) — এই ৪টি তথ্যই আবশ্যিক।
   - **আংশিক তথ্য দিলে বাকি তথ্য চাওয়া (Prompt for Missing Fields Only):**
     ইউজার যদি ৩/৪টির মধ্যে ২/১টি তথ্য দেয় এবং বাকি তথ্যগুলো বাদ রাখে, তবে **কখনোই টুল চালিয়ে কাজ অসমাপ্ত রেখে অনুমান নির্ভরভাবে তৈরি করবে না**।
     ইউজার অলরেডি যে তথ্যগুলো প্রদান করেছে সেগুলো পেয়েছো জানিয়ে বাকি যে তথ্যগুলো বাকি রয়েছে সেগুলো এক মেসেজে নম্বর দিয়ে (১., ২., ৩.) স্পষ্ট করে চেয়ে নাও।
   - *উদাহরণ ১ (ইউজার ১টি তথ্য দিলে):*
     ইউজার: "১ম সাময়িক পরীক্ষা তৈরি করতে চাই"
     AI: "পরীক্ষা তৈরির জন্য বাকি ৩টি তথ্য দিন:
     ১. কোন শ্রেণির জন্য (অথবা 'সকল শ্রেণি')?
     ২. পরীক্ষা শুরুর তারিখ?
     ৩. বিষয়সমূহের তালিকা (যেমন: বাংলা, ইংরেজি, গণিত)?"
   - *উদাহরণ ২ (ইউজার ২টি তথ্য দিলে):*
     ইউজার: "ভর্তি ফি ১০০০ টাকা সেটিং করো"
     AI: "ফি খাতের নাম (ভর্তি ফি) ও পরিমাণ (১০০০ টাকা) পেয়েছি। বাকি ২টি তথ্য দিন:
     ১. কোন শ্রেণির জন্য প্রযোজ্য (অথবা 'সকল শ্রেণি')?
     ২. জমার ধরন (এককালীন / মাসিক / বার্ষিক)?"
   - *উদাহরণ ৩ (ইউজার ৩টি তথ্য দিলে):*
     ইউজার: "সকল শ্রেণির জন্য ভর্তি ফি ১০০০ টাকা সেটিং করো"
     AI: "ফি খাতের নাম, পরিমাণ ও শ্রেণি পেয়েছি। বাকি ১টি তথ্য দিন:
     ১. জমার ধরন (এককালীন / মাসিক / বার্ষিক)?"
   - প্রয়োজনীয় **সকল তথ্য ইউজার থেকে পাওয়ার পর** আর কোনো অতিরিক্ত প্রশ্ন না করে সরাসরি সংশ্লিষ্ট Tool কার্যকর করো।

2. **ভূমিকা ও ফিলার সম্পূর্ণ নিষেধ (No Fluff / Direct To The Point):**
   - "অবশ্যই!", "দারুণ প্রশ্ন!", "আমি আনন্দের সাথে সাহায্য করছি", "ধন্যবাদ" — এই ধরণের কোনো ভূমিকা, চাটুকারিতা বা ফিলার বাক্য সম্পূর্ণ নিষেধ। সরাসরি মূল কথায় আসো।
   - উত্তরের দৈর্ঘ্য সংক্ষেপ ও গঠনমূলক হতে হবে।

3. **কাজ শেষে বাধ্যতামূলক ফরম্যাট (Completion Format):**
   - কোনো কাজ শেষ হলে ঠিক এই ফরম্যাটে রিপ্লাই দাও:
     "✅ [কী হলো]। [মূল তথ্য এক লাইনে]"
   - উদাহরণ: "✅ ১০০০ টাকা ফি সেটিং তৈরি হয়েছে (ভর্তি ফি, সকল শ্রেণি, এককালীন)।" বা "✅ ১ম সাময়িক পরীক্ষা তৈরি হয়েছে (সকল শ্রেণি, ১০ অক্টোবর)।"

4. **এক মেসেজে সব বাকি তথ্য চাওয়া (All-in-one Single Question):**
   - একাধিক তথ্য বাকি থাকলে আলাদা আলাদা মেসেজে জিজ্ঞেস করা নিষেধ। সকল বাকি প্রশ্ন একটিমাত্র মেসেজে নম্বর দিয়ে তালিকা আকারে চেয়ে নাও।

5. **সংবেদনশীল কাজে নিশ্চিতকরণ:**
   - যেকোনো স্থায়ী DELETE (ছাত্র, নোটিশ, শ্রেণি), টাকা জমা / ফি রেকর্ড এবং রেজাল্ট PUBLISH করার আগে ১ লাইনে সামারি দিয়ে শেষে "করবো?" লিখে নিশ্চিত হও। Admin "হ্যাঁ"/"করো" বললেই সম্পাদন করো।

6. **সিস্টেমের গোপনীয়তা:**
   - institute_id বা ইন্টারনাল আইডি অ্যাডমিনের কাছে কখনো চাইবে না বা উত্তরে দেখাবে না। তারিখ বলার সময় "১০ অক্টোবর" এভাবে সহজে বলো।

7. **সুপার এডমিন পারমিশন সিকিউরিটি ও একাউন্ট তৈরির রুলস (Super Admin Security & Account Rules):**
   - **সিকিউরিটি লক (Security Restriction):** শুধুমাত্র সুপার এডমিন বা ম্যানেজার রোলে থাকা ইউজাররা নতুন প্রতিষ্ঠান তৈরি বা পরিচালনা করতে পারবেন। সাধারণ এডমিন থেকে নতুন প্রতিষ্ঠান তৈরির অনুরোধ এলে সংক্ষেপে ১ লাইনে জানাবে যে এই ক্ষমতা শুধুমাত্র সুপার এডমিন বা ম্যানেজারের রয়েছে। পূর্বের কোনো উত্তরের অংশ নতুন উত্তরের সাথে বারবার পুনরাবৃত্তি বা রিপিট করা সম্পূর্ণ নিষেধ।
   - **প্রতিষ্ঠান কোড জিজ্ঞেস করা (Prompt for Institution Code):** নতুন প্রতিষ্ঠান তৈরির সময় প্রতিষ্ঠান কোড না থাকলে জিজ্ঞেস করবে: "প্রতিষ্ঠানের জন্য নির্দিষ্ট কোনো কোড (যেমন: M-1024) দিতে চান, নাকি সিস্টেম থেকে স্বয়ংক্রিয়ভাবে কোড তৈরি করে দেবো?"
   - **পাসওয়ার্ড ও লিমিট ডিফল্ট:** আলাদা পাসওয়ার্ড না দিলে '123456' এবং শিক্ষার্থী সংখ্যা না বললে ডিফল্ট '২০০'।
   - **ঠিকানা ও প্যাকেজ:** ঠিকানা, প্যাকেজ বিবরণ ও পেমেন্ট ধরন কনফিগারেশনে যুক্ত হবে।

8. **ডাটা সিকিউরিটি ও আইসোলেশন (Tenant Data Safety):**
   - তুমি শুধুমাত্র বর্তমান প্রতিষ্ঠান (${options.instituteName}) এবং এর নিবন্ধিত শিক্ষার্থী/স্টাফদের ডাটাবেজ অ্যাক্সেস বা আপডেট করতে পারো।
   - কখনোই অন্য প্রতিষ্ঠানের তথ্য দেখা, পরিবর্তন করা বা অনুমতি ছাড়া ব্যাকএন্ড ইন্টারনাল আইডি শেয়ার করা সম্পূর্ণ নিষিদ্ধ।
   - সমস্ত ডাটাবেজ অপারেশন কড়াভাবে বর্তমান প্রতিষ্ঠানের institution_id দিয়ে ফিল্টার ও নিশ্চিত থাকবে।`;
}

/**
 * Resolves a class ID by name or id within the institute
 */
async function resolveClassId(supabase: any, instituteId: string, classNameOrId?: string): Promise<string | null> {
  if (!classNameOrId) return null;
  const trimmed = classNameOrId.trim();

  // Try direct match by id first
  const { data: byId } = await supabase
    .from('classes')
    .select('id')
    .eq('institution_id', instituteId)
    .eq('id', trimmed)
    .maybeSingle();

  if (byId?.id) return byId.id;

  // Try by class_name (exact or ilike)
  const { data: byName } = await supabase
    .from('classes')
    .select('id, class_name')
    .eq('institution_id', instituteId)
    .ilike('class_name', `%${trimmed}%`)
    .limit(1);

  if (byName && byName.length > 0) {
    return byName[0].id;
  }

  return null;
}

/**
 * Ultra-robust flexible student lookup helper matching names, IDs, snippets, rolls, phones
 */
async function searchStudentsFlexible(
  supabase: any,
  instituteId: string,
  searchInput: string,
  className?: string,
  sectionName?: string
): Promise<any[]> {
  if (!searchInput && !className && !sectionName) return [];
  const query = String(searchInput || '').trim();

  let dbQuery = supabase
    .from('students')
    .select('*, classes(id, class_name)')
    .eq('institution_id', instituteId);

  if (className) {
    const classId = await resolveClassId(supabase, instituteId, className);
    if (classId) dbQuery = dbQuery.eq('class_id', classId);
  }

  if (sectionName) {
    dbQuery = dbQuery.ilike('section', `%${sectionName.trim()}%`);
  }

  const { data: allStudents, error } = await dbQuery.limit(500);
  if (error || !allStudents || allStudents.length === 0) return [];

  if (!query) return allStudents.slice(0, 10);

  const cleanQuery = query.toLowerCase().replace(/\s+/g, ' ');
  const queryWords = cleanQuery.split(' ').filter(w => w.length > 0);

  const scored = allStudents.map((s: any) => {
    let score = 0;
    const idStr = String(s.id || '').toLowerCase();
    const nameStr = String(s.student_name || '').toLowerCase();
    const nameEnStr = String(s.name_en || '').toLowerCase();
    const rollStr = String(s.roll || '');
    const admStr = String(s.admission_number || '').toLowerCase();
    const regStr = String(s.registration_number || '').toLowerCase();
    const phoneStr = String(s.guardian_phone || s.guardian_phone_2 || s.phone || '').toLowerCase();
    const fatherStr = String(s.father_name || s.guardian_name || '').toLowerCase();

    // 1. Exact or partial UUID / ID snippet match (e.g. 'd57b6a')
    if (idStr.includes(cleanQuery)) score += 100;
    // 2. Exact or partial admission / reg / roll match (e.g. 'Abc2001')
    if (admStr.includes(cleanQuery) || regStr.includes(cleanQuery)) score += 90;
    if (rollStr === cleanQuery) score += 80;
    if (phoneStr.includes(cleanQuery)) score += 70;

    // 3. Substring name match (Bangla / English)
    if (nameStr.includes(cleanQuery) || nameEnStr.includes(cleanQuery)) score += 60;
    if (fatherStr.includes(cleanQuery)) score += 40;

    // 4. Word-by-word match for multi-word inputs (e.g., 'আয়ান', 'তানহা')
    queryWords.forEach(w => {
      if (nameStr.includes(w)) score += 25;
      if (nameEnStr.includes(w)) score += 25;
      if (fatherStr.includes(w)) score += 15;
      if (admStr.includes(w) || regStr.includes(w) || idStr.includes(w)) score += 20;
    });

    return { student: s, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.student);
}

/**
 * Executes a tool function securely scoped to the institute_id
 */
export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  instituteId: string,
  userRole: string = 'madrasah_admin'
): Promise<any> {
  const supabase = getSupabaseAdmin();

  try {
    switch (toolName) {
      // -------------------------------------------------------------
      // 1. STUDENTS
      // -------------------------------------------------------------
      case 'search_students': {
        const query = String(args.query || args.search || '').trim();
        const found = await searchStudentsFlexible(supabase, instituteId, query, args.class, args.section);

        const students = found.slice(0, 10).map((s: any) => ({
          student_id: s.id,
          name: s.student_name,
          name_en: s.name_en || 'N/A',
          roll: s.roll || 'N/A',
          admission_number: s.admission_number || s.registration_number || 'N/A',
          class: s.classes?.class_name || 'N/A',
          section: s.section || 'N/A',
          guardian_phone: s.guardian_phone || s.phone || 'N/A',
          guardian_name: s.guardian_name || s.father_name || 'N/A',
          status: s.is_active === false ? 'inactive' : 'active'
        }));

        return {
          found_count: students.length,
          students,
          is_ambiguous: students.length > 1
        };
      }

      case 'get_student': {
        const studentQuery = String(args.student_id || args.query || args.name || '').trim();
        const found = await searchStudentsFlexible(supabase, instituteId, studentQuery);

        if (found.length === 0) {
          return { error: `'${studentQuery}' নামে কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে নাম, রোল, বা আইডি প্রদান করুন।` };
        }

        const student = found[0];
        const studentId = student.id;

        // Fetch fee dues summary
        const { data: feeRows } = await supabase
          .from('fees')
          .select('amount_due, amount_paid, month, status')
          .eq('institution_id', instituteId)
          .eq('student_id', studentId);

        let totalDue = 0;
        let totalPaid = 0;
        (feeRows || []).forEach((f: any) => {
          totalDue += Number(f.amount_due || 0);
          totalPaid += Number(f.amount_paid || 0);
        });

        return {
          student_id: student.id,
          name: student.student_name,
          roll: student.roll || 'N/A',
          admission_number: student.admission_number || student.registration_number || 'N/A',
          class: student.classes?.class_name || 'N/A',
          section: student.section || 'N/A',
          guardian_name: student.guardian_name || student.father_name || 'N/A',
          guardian_phone: student.guardian_phone || student.phone || 'N/A',
          address: student.address || student.permanent_address || 'N/A',
          blood_group: student.blood_group || 'N/A',
          date_of_birth: student.date_of_birth || 'N/A',
          status: student.is_active === false ? 'inactive' : 'active',
          fee_dues: {
            total_due: totalDue,
            total_paid: totalPaid,
            current_status: totalDue > 0 ? `${totalDue} টাকা বকেয়া` : 'কোনো বকেয়া নেই'
          }
        };
      }

      case 'create_student': {
        const classId = await resolveClassId(supabase, instituteId, args.class);
        if (!classId) {
          return { error: `শ্রেণী '${args.class}' খুঁজে পাওয়া যায়নি। সঠিক শ্রেণী উল্লেখ করুন।` };
        }

        const insertPayload: any = {
          institution_id: instituteId,
          class_id: classId,
          student_name: args.name.trim(),
          roll: args.roll ? Number(args.roll) : null,
          section: args.section || null,
          guardian_name: args.guardian_name || null,
          guardian_phone: args.guardian_phone || null,
          address: args.address || null,
          is_active: true
        };

        const { data, error } = await supabase
          .from('students')
          .insert(insertPayload)
          .select('id, student_name, roll, section')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          student_id: data.id,
          name: data.student_name,
          roll: data.roll,
          message: 'শিক্ষার্থী সফলভাবে ভর্তি করা হয়েছে'
        };
      }

      case 'update_student': {
        const studentQuery = String(args.student_id || args.query || args.name || '').trim();
        const found = await searchStudentsFlexible(supabase, instituteId, studentQuery);

        if (found.length === 0) {
          return { error: `'${studentQuery}' চিহ্নিত শিক্ষার্থী পাওয়া যায়নি।` };
        }
        const targetStudent = found[0];
        const studentId = targetStudent.id;

        const updatePayload: any = {};
        if (args.name) updatePayload.student_name = args.name;
        if (args.roll !== undefined) updatePayload.roll = Number(args.roll);
        if (args.section) updatePayload.section = args.section;
        if (args.guardian_name) updatePayload.guardian_name = args.guardian_name;
        if (args.guardian_phone) updatePayload.guardian_phone = args.guardian_phone;
        if (args.address) updatePayload.address = args.address;
        if (args.status) updatePayload.is_active = args.status === 'active';
        if (args.class) {
          const classId = await resolveClassId(supabase, instituteId, args.class);
          if (classId) updatePayload.class_id = classId;
        }

        const { data, error } = await supabase
          .from('students')
          .update(updatePayload)
          .eq('institution_id', instituteId)
          .eq('id', studentId)
          .select('id, student_name, roll')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          student_id: data.id,
          name: data.student_name,
          message: 'শিক্ষার্থীর তথ্য আপডেট করা হয়েছে'
        };
      }

      case 'delete_student': {
        const studentQuery = String(args.student_id || args.query || '').trim();
        const found = await searchStudentsFlexible(supabase, instituteId, studentQuery);

        if (found.length === 0) {
          return { error: `'${studentQuery}' চিহ্নিত শিক্ষার্থী পাওয়া যায়নি।` };
        }
        const targetStudent = found[0];
        const studentId = targetStudent.id;

        const { error } = await supabase
          .from('students')
          .delete()
          .eq('institution_id', instituteId)
          .eq('id', studentId);

        if (error) throw new Error(error.message);
        return {
          success: true,
          message: 'শিক্ষার্থীর রেকর্ড সফলভাবে ডিলিট করা হয়েছে'
        };
      }

      // -------------------------------------------------------------
      // 2. FEES & ACCOUNTS
      // -------------------------------------------------------------
      case 'record_fee_payment': {
        const amount = Number(args.amount);
        const receiptNo = `R-${Math.floor(1000 + Math.random() * 9000)}`;
        const month = args.month || new Date().toISOString().slice(0, 7);
        const studentQuery = String(args.student_id || args.student_name || args.query || '').trim();

        const found = await searchStudentsFlexible(supabase, instituteId, studentQuery);
        if (found.length === 0) {
          return { error: `'${studentQuery}' নামে কোনো শিক্ষার্থী পাওয়া যায়নি` };
        }
        const student = found[0];

        // Insert payment record
        const { data: feeEntry, error: feeErr } = await supabase
          .from('fees')
          .insert({
            institution_id: instituteId,
            student_id: student.id,
            class_id: student.class_id,
            amount_paid: amount,
            amount_due: 0,
            month: month,
            status: 'paid',
            paid_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (feeErr) {
          console.warn('Fee table insert error, trying transactions:', feeErr);
        }

        // Also record transaction in ledger/transactions if table exists
        try {
          await supabase.from('transactions').insert({
            institution_id: instituteId,
            type: 'income',
            category: args.fee_head || 'মাসিক বেতন',
            amount: amount,
            description: `${student.student_name} (রোল ${student.roll || '-'}) - ফি জমা (${args.payment_method || 'cash'})`,
            created_at: new Date().toISOString()
          });
        } catch {}

        return {
          success: true,
          receipt_no: receiptNo,
          student_name: student.student_name,
          amount_paid: amount,
          fee_head: args.fee_head || 'বেতন',
          month: month,
          payment_method: args.payment_method || 'cash',
          message: `ফি সফলভাবে জমা হয়েছে ✅ (রসিদ নং: ${receiptNo})`
        };
      }

      case 'get_fee_dues': {
        let q = supabase
          .from('fees')
          .select('id, student_id, amount_due, month, status, students(id, student_name, roll, classes(class_name))')
          .eq('institution_id', instituteId)
          .gt('amount_due', 0);

        if (args.student_id) {
          q = q.eq('student_id', args.student_id);
        }
        if (args.month) {
          q = q.eq('month', args.month);
        }
        if (args.class) {
          const classId = await resolveClassId(supabase, instituteId, args.class);
          if (classId) q = q.eq('class_id', classId);
        }

        const { data, error } = await q.limit(20);
        if (error) throw new Error(error.message);

        const dues = (data || []).map((d: any) => ({
          student_id: d.student_id,
          name: d.students?.student_name || 'N/A',
          roll: d.students?.roll || 'N/A',
          class: d.students?.classes?.class_name || 'N/A',
          amount_due: d.amount_due,
          month: d.month
        }));

        const totalDue = dues.reduce((sum, item) => sum + Number(item.amount_due || 0), 0);

        return {
          total_students_with_due: dues.length,
          total_due_amount: totalDue,
          dues
        };
      }

      case 'create_fee_head': {
        let classId: string | null = null;
        if (args.applicable_class && args.applicable_class !== 'all') {
          classId = await resolveClassId(supabase, instituteId, args.applicable_class);
        }

        const { data, error } = await supabase
          .from('fee_structures')
          .insert({
            institution_id: instituteId,
            class_id: classId,
            fee_name: args.name,
            amount: Number(args.default_amount),
            created_at: new Date().toISOString()
          })
          .select('id, fee_name, amount')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          fee_head_id: data.id,
          name: data.fee_name,
          amount: data.amount,
          message: 'ফি হেড সফলভাবে তৈরি করা হয়েছে'
        };
      }

      case 'get_fee_collection_report': {
        const from = `${args.from_date}T00:00:00Z`;
        const to = `${args.to_date}T23:59:59Z`;

        const { data, error } = await supabase
          .from('fees')
          .select('amount_paid, amount_due, paid_at')
          .eq('institution_id', instituteId)
          .gte('paid_at', from)
          .lte('paid_at', to);

        if (error) throw new Error(error.message);

        let totalCollected = 0;
        let paymentCount = 0;
        (data || []).forEach((row: any) => {
          if (row.amount_paid > 0) {
            totalCollected += Number(row.amount_paid);
            paymentCount++;
          }
        });

        return {
          from_date: args.from_date,
          to_date: args.to_date,
          total_collected: totalCollected,
          total_payments: paymentCount,
          currency: 'BDT'
        };
      }

      // -------------------------------------------------------------
      // 3. ATTENDANCE
      // -------------------------------------------------------------
      case 'mark_attendance': {
        const classId = await resolveClassId(supabase, instituteId, args.class);
        if (!classId) {
          return { error: `শ্রেণী '${args.class}' খুঁজে পাওয়া যায়নি` };
        }

        const targetDate = args.date || new Date().toISOString().split('T')[0];
        const records = Array.isArray(args.records) ? args.records : [];

        const insertRows = records.map((r: any) => ({
          institution_id: instituteId,
          class_id: classId,
          student_id: r.student_id,
          status: r.status,
          date: targetDate,
          created_at: new Date().toISOString()
        }));

        if (insertRows.length > 0) {
          const { error } = await supabase
            .from('attendance')
            .upsert(insertRows, { onConflict: 'institution_id,student_id,date' });

          if (error) {
            // Fallback regular insert if upsert index is different
            await supabase.from('attendance').insert(insertRows);
          }
        }

        const presentCount = records.filter((r: any) => r.status === 'present').length;
        const absentCount = records.filter((r: any) => r.status === 'absent').length;

        return {
          success: true,
          date: targetDate,
          total_marked: records.length,
          present_count: presentCount,
          absent_count: absentCount,
          message: `হাজিরা সফলভাবে সম্পন্ন হয়েছে ✅ (উপস্থিত: ${presentCount}, অনুপস্থিত: ${absentCount})`
        };
      }

      case 'get_attendance_summary': {
        const classId = await resolveClassId(supabase, instituteId, args.class);
        if (!classId) {
          return { error: `শ্রেণী '${args.class}' খুঁজে পাওয়া যায়নি` };
        }

        const { data, error } = await supabase
          .from('attendance')
          .select('student_id, status, date, students(student_name, roll)')
          .eq('institution_id', instituteId)
          .eq('class_id', classId)
          .gte('date', args.from_date)
          .lte('date', args.to_date);

        if (error) throw new Error(error.message);

        let present = 0;
        let absent = 0;
        let late = 0;
        let leave = 0;

        (data || []).forEach((row: any) => {
          if (row.status === 'present') present++;
          else if (row.status === 'absent') absent++;
          else if (row.status === 'late') late++;
          else if (row.status === 'leave') leave++;
        });

        const totalRecords = present + absent + late + leave;
        const rate = totalRecords > 0 ? Math.round((present / totalRecords) * 100) : 0;

        return {
          class: args.class,
          from_date: args.from_date,
          to_date: args.to_date,
          total_entries: totalRecords,
          present_count: present,
          absent_count: absent,
          late_count: late,
          attendance_percentage: `${rate}%`
        };
      }

      // -------------------------------------------------------------
      // 4. EXAM & RESULT
      // -------------------------------------------------------------
      case 'create_exam': {
        const examName = (args.name || args.exam_name || '').trim();
        if (!examName) {
          return { error: 'পরীক্ষার নাম আবশ্যক' };
        }

        // Fetch institution configuration for active academic year
        const { data: inst } = await supabase
          .from('institutions')
          .select('id, config_json')
          .eq('id', instituteId)
          .maybeSingle();

        let activeYearId = (inst?.config_json as any)?.active_academic_year_id || null;
        if (!activeYearId) {
          const { data: activeYearRow } = await supabase
            .from('academic_years')
            .select('id')
            .eq('institution_id', instituteId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();
          if (activeYearRow?.id) {
            activeYearId = activeYearRow.id;
          }
        }

        const targetDate = args.start_date || new Date().toISOString().split('T')[0];
        const subjects = Array.isArray(args.subjects) ? args.subjects : [];

        // Determine target classes
        let targetClasses: { id: string | null; name: string }[] = [];

        if (args.class && args.class !== 'all' && args.class !== 'সকল' && args.class !== 'সকল ক্লাস') {
          const classId = await resolveClassId(supabase, instituteId, args.class);
          targetClasses = [{ id: classId, name: args.class }];
        } else {
          // If no specific class provided, create for all classes so it appears in the Exam UI for every class
          const { data: existingClasses } = await supabase
            .from('classes')
            .select('id, class_name')
            .eq('institution_id', instituteId)
            .order('sort_order', { ascending: true });

          if (existingClasses && existingClasses.length > 0) {
            targetClasses = existingClasses.map((c: any) => ({ id: c.id, name: c.class_name }));
          } else {
            targetClasses = [{ id: null, name: 'সাধারণ' }];
          }
        }

        const createdExams = [];

        for (const cls of targetClasses) {
          const examData: any = {
            institution_id: instituteId,
            class_id: cls.id,
            exam_name: examName,
            exam_date: targetDate,
            is_published: false,
            created_at: new Date().toISOString()
          };

          if (activeYearId) {
            examData.academic_year_id = activeYearId;
          }

          let { data: exam, error: examErr } = await supabase
            .from('exams')
            .insert(examData)
            .select('id, exam_name, class_id')
            .single();

          // Fallback if foreign key on academic_year_id fails
          if (examErr && (examErr.message.includes('foreign key') || examErr.message.includes('academic_year_id'))) {
            delete examData.academic_year_id;
            const retry = await supabase.from('exams').insert(examData).select('id, exam_name, class_id').single();
            exam = retry.data;
            examErr = retry.error;
          }

          // Also populate befaq_exams table if exists
          try {
            const befaqData: any = {
              institution_id: instituteId,
              marhala_id: cls.id,
              exam_name: examName,
              exam_date: targetDate,
              is_published: false,
              created_at: new Date().toISOString()
            };
            if (activeYearId) befaqData.academic_year_id = activeYearId;
            await supabase.from('befaq_exams').insert(befaqData);
          } catch {
            // ignore fallback
          }

          if (exam && exam.id) {
            createdExams.push({ id: exam.id, name: exam.exam_name, class: cls.name });

            // Insert subjects if provided
            if (subjects.length > 0) {
              const subjectRows = subjects.map((sub: any, index: number) => ({
                exam_id: exam.id,
                subject_name: typeof sub === 'string' ? sub.trim() : (sub.name || 'বিষয়'),
                full_marks: typeof sub === 'object' && sub.full_marks ? Number(sub.full_marks) : 100,
                pass_marks: typeof sub === 'object' && sub.pass_marks ? Number(sub.pass_marks) : 33,
                sort_order: index + 1
              }));
              await supabase.from('exam_subjects').insert(subjectRows);
            }
          }
        }

        const classNamesStr = targetClasses.map(t => t.name).join(', ');

        return {
          success: true,
          exams_created: createdExams.length,
          name: examName,
          date: targetDate,
          classes: classNamesStr,
          subjects_count: subjects.length,
          message: `নতুন পরীক্ষা '${examName}' সফলভাবে তৈরি হয়েছে (${classNamesStr}) ✅`
        };
      }

      case 'list_exams': {
        let query = supabase
          .from('exams')
          .select('id, exam_name, exam_date, is_published, classes(id, class_name)')
          .eq('institution_id', instituteId);

        if (args.class) {
          const classId = await resolveClassId(supabase, instituteId, args.class);
          if (classId) {
            query = query.eq('class_id', classId);
          }
        }

        const { data: exams, error } = await query.order('created_at', { ascending: false }).limit(20);

        if (error) throw new Error(error.message);

        return {
          total: (exams || []).length,
          exams: (exams || []).map((e: any) => ({
            id: e.id,
            name: e.exam_name,
            date: e.exam_date,
            class: e.classes?.class_name || 'সকল ক্লাস',
            is_published: !!e.is_published
          }))
        };
      }

      case 'record_marks': {
        // Find subject id
        const { data: subjectRow } = await supabase
          .from('exam_subjects')
          .select('id')
          .eq('exam_id', args.exam_id)
          .ilike('subject_name', `%${args.subject.trim()}%`)
          .limit(1)
          .maybeSingle();

        const subjectId = subjectRow?.id;
        const records = Array.isArray(args.records) ? args.records : [];

        const markRows = records.map((r: any) => ({
          exam_id: args.exam_id,
          subject_id: subjectId || null,
          student_id: r.student_id,
          marks_obtained: Number(r.marks_obtained || 0)
        }));

        if (markRows.length > 0) {
          await supabase.from('exam_marks').upsert(markRows, { onConflict: 'exam_id,subject_id,student_id' });
        }

        return {
          success: true,
          subject: args.subject,
          records_saved: records.length,
          message: `${args.subject} বিষয়ের ${records.length} জন শিক্ষার্থীর নম্বর সংরক্ষিত হয়েছে ✅`
        };
      }

      case 'get_merit_list': {
        const { data: marks, error } = await supabase
          .from('exam_marks')
          .select('student_id, marks_obtained, students(student_name, roll, classes(class_name))')
          .eq('exam_id', args.exam_id);

        if (error) throw new Error(error.message);

        // Aggregate by student
        const studentTotals: Record<string, { name: string; roll: any; total: number }> = {};
        (marks || []).forEach((m: any) => {
          if (!studentTotals[m.student_id]) {
            studentTotals[m.student_id] = {
              name: m.students?.student_name || 'N/A',
              roll: m.students?.roll || 'N/A',
              total: 0
            };
          }
          studentTotals[m.student_id].total += Number(m.marks_obtained || 0);
        });

        const sorted = Object.entries(studentTotals)
          .map(([id, info]) => ({ student_id: id, ...info }))
          .sort((a, b) => b.total - a.total);

        const limit = args.top_n ? Number(args.top_n) : 10;
        const meritList = sorted.slice(0, limit).map((s, idx) => ({
          rank: idx + 1,
          name: s.name,
          roll: s.roll,
          total_marks: s.total
        }));

        return {
          exam_id: args.exam_id,
          total_ranked_students: sorted.length,
          merit_list: meritList
        };
      }

      case 'publish_result': {
        const { error } = await supabase
          .from('exams')
          .update({ is_published: true })
          .eq('institution_id', instituteId)
          .eq('id', args.exam_id);

        if (error) throw new Error(error.message);
        return {
          success: true,
          exam_id: args.exam_id,
          message: 'পরীক্ষার রেজাল্ট সফলভাবে পাবলিশ করা হয়েছে ✅ অভিভাবক ও ছাত্ররা এখন রেজাল্ট দেখতে পারবে।'
        };
      }

      // -------------------------------------------------------------
      // 5. NOTICES
      // -------------------------------------------------------------
      case 'create_notice': {
        const audienceTag = args.audience === 'specific_class' && args.class ? args.class : (args.audience || 'All');
        const publishNow = args.publish_now !== false;

        const { data, error } = await supabase
          .from('messages')
          .insert({
            institution_id: instituteId,
            class_name: publishNow ? 'APP_NOTICE' : 'APP_NOTICE_DRAFT',
            title: args.title,
            message: args.body,
            sender_name: 'Admin AI Agent',
            created_at: new Date().toISOString()
          })
          .select('id, title')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          notice_id: data.id,
          title: data.title,
          status: publishNow ? 'published' : 'draft',
          message: publishNow ? 'নোটিশটি সফলভাবে প্রকাশ করা হয়েছে ✅' : 'নোটিশটি ড্রাফট হিসেবে সংরক্ষণ করা হয়েছে'
        };
      }

      case 'update_notice': {
        const updatePayload: any = {};
        if (args.title) updatePayload.title = args.title;
        if (args.body) updatePayload.message = args.body;

        const { data, error } = await supabase
          .from('messages')
          .update(updatePayload)
          .eq('institution_id', instituteId)
          .eq('id', args.notice_id)
          .select('id, title')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          notice_id: data.id,
          message: 'নোটিশ সফলভাবে এডিট করা হয়েছে'
        };
      }

      case 'delete_notice': {
        const { error } = await supabase
          .from('messages')
          .delete()
          .eq('institution_id', instituteId)
          .eq('id', args.notice_id);

        if (error) throw new Error(error.message);
        return {
          success: true,
          message: 'নোটিশটি সফলভাবে ডিলিট করা হয়েছে'
        };
      }

      case 'list_notices': {
        const limit = args.limit ? Number(args.limit) : 10;
        const { data, error } = await supabase
          .from('messages')
          .select('id, title, message, class_name, created_at')
          .eq('institution_id', instituteId)
          .ilike('class_name', 'APP_%')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) throw new Error(error.message);

        const notices = (data || []).map((m: any) => ({
          notice_id: m.id,
          title: m.title,
          body: m.message,
          type: m.class_name,
          date: m.created_at ? new Date(m.created_at).toLocaleDateString('bn-BD') : ''
        }));

        return {
          count: notices.length,
          notices
        };
      }

      // -------------------------------------------------------------
      // 6. STAFF
      // -------------------------------------------------------------
      case 'list_staff': {
        let q = supabase
          .from('teachers')
          .select('id, teacher_name, designation, mobile, status, is_active, basic_salary')
          .eq('institution_id', instituteId);

        if (args.status) {
          q = q.eq('status', args.status);
        }

        const { data, error } = await q.limit(20);
        if (error) throw new Error(error.message);

        const staffList = (data || []).map((t: any) => ({
          staff_id: t.id,
          name: t.teacher_name,
          role: t.designation || 'Teacher',
          phone: t.mobile || 'N/A',
          salary: t.basic_salary || 0,
          status: t.is_active === false ? 'inactive' : 'active'
        }));

        return {
          count: staffList.length,
          staff: staffList
        };
      }

      case 'create_staff': {
        const { data, error } = await supabase
          .from('teachers')
          .insert({
            institution_id: instituteId,
            teacher_name: args.name.trim(),
            designation: args.role || 'Teacher',
            mobile: args.phone || null,
            basic_salary: args.salary ? Number(args.salary) : 0,
            status: 'active',
            is_active: true,
            created_at: new Date().toISOString()
          })
          .select('id, teacher_name, designation')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          staff_id: data.id,
          name: data.teacher_name,
          role: data.designation,
          message: 'স্টাফ/শিক্ষক সফলভাবে যোগ করা হয়েছে ✅'
        };
      }

      case 'update_staff': {
        const updatePayload: any = {};
        if (args.name) updatePayload.teacher_name = args.name;
        if (args.role) updatePayload.designation = args.role;
        if (args.phone) updatePayload.mobile = args.phone;
        if (args.salary !== undefined) updatePayload.basic_salary = Number(args.salary);
        if (args.status) {
          updatePayload.status = args.status;
          updatePayload.is_active = args.status === 'active';
        }

        const { data, error } = await supabase
          .from('teachers')
          .update(updatePayload)
          .eq('institution_id', instituteId)
          .eq('id', args.staff_id)
          .select('id, teacher_name')
          .single();

        if (error) throw new Error(error.message);
        return {
          success: true,
          staff_id: data.id,
          name: data.teacher_name,
          message: 'স্টাফের তথ্য আপডেট করা হয়েছে'
        };
      }

      // -------------------------------------------------------------
      // 7. ACADEMIC CLASSES
      // -------------------------------------------------------------
      case 'create_class': {
        const className = (args.name || args.class_name || '').trim();
        if (!className) {
          return { error: 'ক্লাসের নাম আবশ্যক' };
        }

        let sortOrder = typeof args.sort_order === 'number' ? args.sort_order : (typeof args.serial === 'number' ? args.serial : null);
        if (sortOrder === null) {
          const { count } = await supabase
            .from('classes')
            .select('*', { count: 'exact', head: true })
            .eq('institution_id', instituteId);
          sortOrder = (count || 0) + 1;
        }

        const { data: newClass, error: classErr } = await supabase
          .from('classes')
          .insert({
            institution_id: instituteId,
            class_name: className,
            sort_order: sortOrder,
            created_at: new Date().toISOString()
          })
          .select('id, class_name, sort_order')
          .single();

        if (classErr) throw new Error(classErr.message);

        return {
          success: true,
          id: newClass.id,
          name: newClass.class_name,
          sort_order: newClass.sort_order,
          message: `নতুন শ্রেণি '${newClass.class_name}' সফলভাবে তৈরি করা হয়েছে (সিরিয়াল: ${newClass.sort_order}) ✅`
        };
      }

      case 'list_classes': {
        const { data, error } = await supabase
          .from('classes')
          .select('id, class_name, sort_order')
          .eq('institution_id', instituteId)
          .order('sort_order', { ascending: true });

        if (error) throw new Error(error.message);

        return {
          total_classes: (data || []).length,
          classes: (data || []).map((c: any) => ({
            id: c.id,
            name: c.class_name,
            sort_order: c.sort_order
          }))
        };
      }

      case 'delete_class': {
        const classId = await resolveClassId(supabase, instituteId, args.class_id);
        if (!classId) {
          return { error: 'শ্রেণিটি খুঁজে পাওয়া যায়নি' };
        }

        const { error } = await supabase
          .from('classes')
          .delete()
          .eq('institution_id', instituteId)
          .eq('id', classId);

        if (error) throw new Error(error.message);

        return {
          success: true,
          message: 'শ্রেণিটি সফলভাবে মুছে ফেলা হয়েছে ✅'
        };
      }

      // -------------------------------------------------------------
      // 8. SUPER ADMIN & SYSTEM MANAGEMENT
      // -------------------------------------------------------------
      case 'create_institution': {
        if (userRole !== 'super_admin' && userRole !== 'manager') {
          return { error: 'অনুমতি নেই: নতুন প্রতিষ্ঠান অ্যাকাউন্ট তৈরি করার অধিকার শুধুমাত্র প্ল্যাটফর্মের সুপার এডমিন বা ম্যানেজারের রয়েছে।' };
        }

        const name = (args.name || '').trim();
        const phone = (args.phone || '').trim();
        const email = (args.email || '').trim().toLowerCase();
        const password = (args.password || '123456').trim(); // Default password 123456
        const address = (args.address || '').trim();
        const instType = args.institution_type || 'madrasah';
        const studentLimit = typeof args.student_limit === 'number' ? args.student_limit : 200; // Default student_limit 200
        const pkg = args.package || 'প্যাকেজ ২';
        const paymentType = args.payment_type || 'monthly';
        const yearStart = args.academic_year_start || new Date().toISOString().split('T')[0];

        if (!name || !phone || !email) {
          return { error: 'প্রতিষ্ঠানের নাম, ফোন নম্বর এবং ইমেইল প্রদান করতে হবে।' };
        }

        // Auto-generate institution code e.g. M-1024 or M-4829
        const instCode = args.institution_code || `M-${Math.floor(1000 + Math.random() * 9000)}`;

        let userId: string | null = null;
        try {
          const { data: listData } = await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(u => u.email?.toLowerCase() === email);
          if (existing) {
            userId = existing.id;
          }
        } catch (e) {
          console.warn('listUsers check warning:', e);
        }

        if (!userId) {
          const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { name, madrasah_name: name, role: 'madrasah_admin' }
          });

          if (authError) {
            if (authError.message.includes('already registered')) {
              const { data: listData } = await supabase.auth.admin.listUsers();
              const found = listData?.users?.find(u => u.email?.toLowerCase() === email);
              if (found) userId = found.id;
              else throw authError;
            } else {
              throw authError;
            }
          } else {
            userId = authData.user.id;
          }
        }

        if (!userId) return { error: 'অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে' };

        const instPayload: any = {
          id: userId,
          name,
          email,
          phone,
          address: address || null,
          institution_type: instType,
          is_active: true,
          is_super_admin: false,
          status: 'active',
          config_json: {
            student_limit: studentLimit,
            institution_code: instCode,
            address: address,
            package: pkg,
            payment_type: paymentType,
            academic_year_start: yearStart,
            modules: {
              attendance: true,
              exam: true,
              results: true,
              admit_card: true,
              seat_plan: true,
              exam_routine: true,
              accounting: true,
              voice_broadcast: true,
              sms: true,
              certificates: true,
              class_routine: true
            },
            result_engine: 'school',
            result_system: 'grading',
            fee_structure: 'monthly',
            ui_mode: 'madrasah'
          }
        };

        // Try attaching institute_code if column exists
        try {
          instPayload.institute_code = instCode;
        } catch {}

        let { data: inst, error: instErr } = await supabase.from('institutions').upsert(instPayload).select().single();

        if (instErr) {
          delete instPayload.institute_code;
          const retryRes = await supabase.from('institutions').upsert(instPayload).select().single();
          if (retryRes.error) throw new Error(retryRes.error.message);
          inst = retryRes.data;
        }

        await supabase.from('profiles').upsert({
          id: userId,
          institution_id: userId,
          full_name: name,
          role: 'madrasah_admin',
          mobile: phone,
          is_active: true
        });

        return {
          success: true,
          institution_id: userId,
          name,
          email,
          phone,
          password,
          address: address || 'N/A',
          institution_code: instCode,
          package: pkg,
          student_limit: studentLimit,
          message: `নতুন প্রতিষ্ঠান '${name}' সফলভাবে তৈরি হয়েছে ✅ (কোড: ${instCode}, ইমেইল: ${email}, পাসওয়ার্ড: ${password}, ঠিকানা: ${address || 'N/A'}, শিক্ষার্থী লিমিট: ${studentLimit}, প্যাকেজ: ${pkg})`
        };
      }

      case 'list_institutions': {
        if (userRole !== 'super_admin' && userRole !== 'manager') {
          return { error: 'অনুমতি নেই: প্রতিষ্ঠানের তালিকা দেখার অধিকার শুধুমাত্র প্ল্যাটফর্মের সুপার এডমিন বা ম্যানেজারের রয়েছে।' };
        }

        let q = supabase
          .from('institutions')
          .select('id, name, phone, email, status, is_active, balance, institution_type, created_at');

        if (args.search) {
          const s = args.search.trim();
          q = q.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
        }
        if (args.status) {
          q = q.eq('status', args.status);
        }

        const { data, error } = await q.order('created_at', { ascending: false }).limit(20);
        if (error) throw new Error(error.message);

        return {
          total: (data || []).length,
          institutions: (data || []).map((i: any) => ({
            id: i.id,
            name: i.name,
            phone: i.phone || 'N/A',
            email: i.email || 'N/A',
            status: i.status || (i.is_active ? 'active' : 'inactive'),
            balance: Number(i.balance || 0),
            type: i.institution_type || 'madrasah'
          }))
        };
      }

      case 'update_institution_status': {
        if (userRole !== 'super_admin' && userRole !== 'manager') {
          return { error: 'অনুমতি নেই: প্রতিষ্ঠানের স্ট্যাটাস পরিবর্তন করার অধিকার শুধুমাত্র প্ল্যাটফর্মের সুপার এডমিন বা ম্যানেজারের রয়েছে।' };
        }

        let targetId = args.institution_id;
        const { data: found } = await supabase
          .from('institutions')
          .select('id, name')
          .or(`id.eq.${targetId},name.ilike.%${targetId}%`)
          .limit(1)
          .maybeSingle();

        if (found) targetId = found.id;

        const updateData: any = {};
        if (args.status) updateData.status = args.status;
        if (args.is_active !== undefined) updateData.is_active = args.is_active;
        if (args.balance !== undefined) updateData.balance = Number(args.balance);

        const { data, error } = await supabase
          .from('institutions')
          .update(updateData)
          .eq('id', targetId)
          .select('id, name, status, is_active')
          .single();

        if (error) throw new Error(error.message);

        return {
          success: true,
          institution_id: data.id,
          name: data.name,
          status: data.status,
          message: `'${data.name}' প্রতিষ্ঠানের স্ট্যাটাস আপডেট করা হয়েছে ✅`
        };
      }

      case 'get_superadmin_stats': {
        if (userRole !== 'super_admin' && userRole !== 'manager') {
          return { error: 'অনুমতি নেই: প্ল্যাটফর্মের সার্বিক রিপোর্ট দেখার অধিকার শুধুমাত্র সুপার এডমিন বা ম্যানেজারের রয়েছে।' };
        }

        const [instRes, studRes, teacherRes] = await Promise.all([
          supabase.from('institutions').select('id, status, is_active, balance'),
          supabase.from('students').select('*', { count: 'exact', head: true }),
          supabase.from('teachers').select('*', { count: 'exact', head: true })
        ]);

        const insts = instRes.data || [];
        const totalInsts = insts.length;
        const activeInsts = insts.filter((i: any) => i.is_active && i.status !== 'suspended').length;
        const suspendedInsts = insts.filter((i: any) => i.status === 'suspended').length;
        const totalBalance = insts.reduce((sum: number, i: any) => sum + Number(i.balance || 0), 0);

        return {
          total_institutions: totalInsts,
          active_institutions: activeInsts,
          suspended_institutions: suspendedInsts,
          total_students: studRes.count || 0,
          total_teachers: teacherRes.count || 0,
          total_platform_balance_bdt: totalBalance
        };
      }

      case 'recharge_institution_balance': {
        if (userRole !== 'super_admin' && userRole !== 'manager') {
          return { error: 'অনুমতি নেই: প্রতিষ্ঠানে রিচার্জ করার অধিকার শুধুমাত্র সুপার এডমিন বা ম্যানেজারের রয়েছে।' };
        }

        let targetId = args.institution_id;
        const { data: found } = await supabase
          .from('institutions')
          .select('id, name, balance')
          .or(`id.eq.${targetId},name.ilike.%${targetId}%`)
          .limit(1)
          .maybeSingle();

        if (!found) return { error: 'প্রতিষ্ঠানটি খুঁজে পাওয়া যায়নি' };
        targetId = found.id;

        const currentBal = Number(found.balance || 0);
        const addAmount = Number(args.amount || 0);
        const newBal = currentBal + addAmount;

        const { error: updateErr } = await supabase
          .from('institutions')
          .update({ balance: newBal })
          .eq('id', targetId);

        if (updateErr) throw new Error(updateErr.message);

        await supabase.from('transactions').insert({
          institution_id: targetId,
          amount: addAmount,
          transaction_id: `RECHARGE_AGENT_${Date.now()}`,
          sender_phone: 'SUPER_ADMIN_AGENT',
          description: args.remarks || 'Recharged by Super Admin Agent',
          type: 'credit',
          status: 'approved',
          module: 'recharge'
        });

        return {
          success: true,
          institution_id: targetId,
          name: found.name,
          recharged_amount: addAmount,
          new_balance: newBal,
          message: `'${found.name}' প্রতিষ্ঠানে ${addAmount} ৳ রিচার্জ করা হয়েছে ✅ (নতুন ব্যালেন্স: ${newBal} ৳)`
        };
      }

      case 'get_institution_transactions': {
        const searchKey = String(args.institution_id || instituteId || '').trim();

        // Search in institutions table by id, institute_code, name, or config_json
        const { data: insts } = await supabase
          .from('institutions')
          .select('id, name, balance, institute_code, config_json');

        const found = insts?.find((i: any) => {
          const idMatch = i.id === searchKey;
          const codeMatch = i.institute_code && String(i.institute_code).toLowerCase() === searchKey.toLowerCase();
          const configCode = (i.config_json as any)?.institute_code || (i.config_json as any)?.institution_code;
          const configCodeMatch = configCode && String(configCode).toLowerCase() === searchKey.toLowerCase();
          const nameMatch = i.name && i.name.toLowerCase().includes(searchKey.toLowerCase());
          return idMatch || codeMatch || configCodeMatch || nameMatch;
        });

        if (!found) return { error: `'${searchKey}' কোড বা নামের কোনো প্রতিষ্ঠান খুঁজে পাওয়া যায়নি` };

        // Permission check: Allowed if caller is super_admin/manager OR querying their own institution!
        const isOwn = instituteId && (instituteId === found.id || instituteId === 'system_super_admin');
        const isSuper = userRole === 'super_admin' || userRole === 'manager';
        if (!isSuper && !isOwn) {
          return { error: 'অনুমতি নেই: অন্য প্রতিষ্ঠানের লেনদেন দেখার অধিকার আপনার নেই।' };
        }

        const targetId = found.id;

        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('institution_id', targetId)
          .order('created_at', { ascending: false })
          .limit(args.limit || 30);

        if (error) throw new Error(error.message);

        const currentBal = Number(found.balance || 0);
        let running = currentBal;

        // Walk backwards through transactions to compute balances before each transaction
        const timeline = (transactions || []).map((t: any) => {
          const amt = Number(t.amount || 0);
          const type = t.type;
          const status = t.status || 'approved';
          const balAfter = running;
          let balBefore = running;
          if (status === 'approved') {
            if (type === 'credit') {
              balBefore = running - amt;
              running = balBefore;
            } else if (type === 'debit') {
              balBefore = running + amt;
              running = balBefore;
            }
          }
          return {
            id: t.id,
            amount: amt,
            type: t.type,
            module: t.module,
            description: t.description,
            status: t.status,
            balance_before: Math.round(balBefore * 100) / 100,
            balance_after: Math.round(balAfter * 100) / 100,
            created_at: t.created_at
          };
        });

        // Filter voice recharge specific transactions
        const voiceTxs = timeline.filter((t: any) =>
          (t.module === 'voice' || (t.description && t.description.toLowerCase().includes('voice'))) &&
          t.type === 'credit'
        );

        const approvedVoiceTxs = voiceTxs.filter((t: any) => t.status === 'approved');
        const pendingVoiceTxs = voiceTxs.filter((t: any) => t.status === 'pending');
        const totalVoiceApproved = approvedVoiceTxs.reduce((sum: number, t: any) => sum + t.amount, 0);

        // Earliest approved voice recharge in this batch to find balance before voice recharge
        const earliestApprovedVoice = approvedVoiceTxs.length > 0 ? approvedVoiceTxs[approvedVoiceTxs.length - 1] : null;

        return {
          institution_id: targetId,
          institution_name: found.name,
          institute_code: found.institute_code || (found.config_json as any)?.institute_code || 'N/A',
          current_balance: currentBal,
          voice_recharge_summary: {
            total_voice_recharge_added: totalVoiceApproved,
            balance_before_voice_recharge: earliestApprovedVoice ? earliestApprovedVoice.balance_before : currentBal,
            approved_recharges: approvedVoiceTxs.map((t: any) => ({
              amount: t.amount,
              description: t.description,
              balance_before: t.balance_before,
              balance_after: t.balance_after,
              date: t.created_at
            })),
            pending_recharges: pendingVoiceTxs.map((t: any) => ({
              amount: t.amount,
              description: t.description,
              date: t.created_at
            }))
          },
          recent_transactions: timeline.slice(0, 10)
        };
      }

      default:
        return { error: `অজানা টুল: ${toolName}` };
    }
  } catch (err: any) {
    console.error(`Error in tool ${toolName}:`, err);
    return {
      error: `টুল এক্সিকিউশন ব্যর্থ: ${err.message || 'Unknown database error'}`
    };
  }
}
