
import { Student } from '../../types';

export interface AdmissionFormData extends Partial<Student> {
  formNumber?: string;
  admissionDate?: string;
  academicYear?: string;
  session?: string;
  previousInstitution?: string;
  previousClass?: string;
  admissionClass?: string;
  documentsChecked?: string[];
  photoUrl?: string;
  
  // Explicitly defining fields that might be missing or need mapping
  studentName?: string;
  studentNameEn?: string;
  fatherName?: string;
  fatherOccupation?: string;
  motherName?: string;
  motherOccupation?: string;
  guardianRelation?: string;
  nationality?: string;
  religion?: string;
  gender?: 'male' | 'female' | 'other';
  presentAddress?: string;
  permanentAddress?: string;
}

export interface AdmissionFormConfig {
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
    declaration: string;
    officeUse: string;
  };
  fieldVisibility: Record<string, boolean>;
  customText?: string;
  signatureLabels: {
    student: string;
    parent: string;
    principal: string;
  };
}

export type AdmissionFormLang = 'bn' | 'en';
