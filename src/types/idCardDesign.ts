export interface IdCardDesignSettings {
  themeColor: string;
  layoutStyle: 'modern_wave' | 'minimal_clean' | 'royal_arch' | 'bold_banner';
  
  // Institution Name & Address
  instNameSize: number; // in px
  instNameColor?: string;
  instAddressSize: number; // in px
  
  // Logo
  showLogo: boolean;
  logoSize: number; // in px
  
  // Photo
  showPhoto: boolean;
  photoWidth: number; // in px
  photoHeight: number; // in px
  photoRadius: number; // in px (0 to 45)
  photoBorderWidth: number; // in px
  
  // Badge
  badgeText: string;
  badgeBgColor: string;
  
  // Student/Teacher Name
  nameSize: number; // in px
  nameColor: string;
  
  // Field Sizes & Spacing
  fieldFontSize: number; // in px
  fieldValueSize: number; // in px
  labelWidth: number; // in px
  
  // Visibility toggles for fields
  showClass: boolean;
  showSection: boolean;
  showId: boolean;
  showDob: boolean;
  showBlood: boolean;
  showFather: boolean;
  showMother: boolean;
  showPhone: boolean;
  showAddress: boolean;
  showDesignation?: boolean;
  
  // Backside
  showQrCode: boolean;
  qrSize: number; // in px
  showPrincipalSign: boolean;
  signatureHeight: number; // in px
  principalTitle: string;
  mottoText: string;
}

export const DEFAULT_ID_CARD_DESIGN: IdCardDesignSettings = {
  themeColor: '#1E3A8A',
  layoutStyle: 'modern_wave',
  
  instNameSize: 16,
  instAddressSize: 8,
  
  showLogo: true,
  logoSize: 48,
  
  showPhoto: true,
  photoWidth: 75,
  photoHeight: 85,
  photoRadius: 12,
  photoBorderWidth: 2,
  
  badgeText: '',
  badgeBgColor: '',
  
  nameSize: 16,
  nameColor: '',
  
  fieldFontSize: 10,
  fieldValueSize: 11.5,
  labelWidth: 75,
  
  showClass: true,
  showSection: true,
  showId: true,
  showDob: true,
  showBlood: true,
  showFather: true,
  showMother: true,
  showPhone: true,
  showAddress: true,
  showDesignation: true,
  
  showQrCode: true,
  qrSize: 65,
  showPrincipalSign: true,
  signatureHeight: 22,
  principalTitle: '',
  mottoText: ''
};
