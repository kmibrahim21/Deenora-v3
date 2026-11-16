import { Student } from '../../types';

export type AdmissionLayoutMode = '1-page' | '2-page';

export interface AdmissionFormData extends Omit<Partial<Student>, 'department'> {
  // A. Institutional & Metadata
  formNumber?: string;
  admissionDate?: string;
  academicYear?: string;
  session?: string;

  // B. Student Information
  studentName?: string;
  studentNameEn?: string;
  username?: string;
  biometricId?: string;
  birthRegNo?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other' | string;
  blood_group?: string;
  religion?: string;
  nationality?: string;
  admissionClass?: string;
  department?: string;
  residentialStatus?: string;
  photoUrl?: string;

  // C. Parents & Guardian Information
  fatherName?: string;
  fatherOccupation?: string;
  fatherNid?: string;
  motherName?: string;
  motherOccupation?: string;
  motherNid?: string;
  guardian_name?: string;
  guardianRelation?: string;
  guardian_phone?: string;
  whatsappNumber?: string;
  emergencyPhone?: string;

  // D. Address & Academic History
  presentAddress?: string;
  permanentAddress?: string;
  previousInstitution?: string;
  previousClass?: string;
  tcNumber?: string;

  // E. Fees & Financials
  admissionFee?: string;
  monthlyFee?: string;
  receiptNumber?: string;

  // F. Document Verification Checklist
  documentsChecked?: string[];
}

export interface AdmissionFormConfig {
  layoutMode: AdmissionLayoutMode;
  themeColor: string;
  fontScale: number;
  showLogo: boolean;
  showWatermark: boolean;
  watermarkText?: string;
  sectionHeadings: {
    studentInfo: string;
    parentInfo: string;
    addressInfo: string;
    prevInstInfo: string;
    financialInfo: string;
    documentsInfo: string;
    rulesHeading: string;
    declaration: string;
    officeUse: string;
    slipHeading: string;
  };
  fieldVisibility: Record<string, boolean>;
  rulesText: string;
  declarationText: string;
  customText?: string;
  signatureLabels: {
    student: string;
    parent: string;
    principal: string;
    collector: string;
  };
}

export type AdmissionFormLang = 'bn' | 'en';
