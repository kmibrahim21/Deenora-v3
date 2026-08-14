export const getPackageLevel = (pkgName?: string): number => {
  if (!pkgName) return 1;
  const name = String(pkgName).trim().toUpperCase();
  if (name === '1' || name === 'STARTER' || name === 'স্টার্টার') return 1;
  if (name === '2' || name === 'BASIC' || name === 'বেসিক') return 2;
  if (name === '3' || name === 'SMART' || name === 'স্মার্ট') return 3;
  if (name === '4' || name === 'ACADEMIC' || name === 'একাডেমিক') return 4;
  if (name === '5' || name === 'STANDARD' || name === 'স্ট্যান্ডার্ড') return 5;
  if (name === '6' || name === 'FINANCE' || name === 'ফিনান্স') return 6;
  if (name === '7' || name === 'PROFESSIONAL' || name === 'প্রফেশনাল') return 7;
  if (name === '8' || name === 'ENTERPRISE' || name === 'এন্টারপ্রাইজ') return 8;
  if (name === '9' || name === 'ENTERPRISE PLUS' || name === 'এন্টারপ্রাইজ প্লাস') return 9;
  if (name === '10' || name === 'ULTIMATE' || name === 'আল্টিমেট') return 10;
  
  const num = parseInt(name, 10);
  if (!isNaN(num)) return num;

  if (name.includes('ULTIMATE') || name.includes('আল্টিমেট')) return 10;
  if (name.includes('ENTERPRISE') || name.includes('এন্টারপ্রাইজ')) return 8;
  if (name.includes('PROFESSIONAL') || name.includes('প্রফেশনাল')) return 7;
  if (name.includes('FINANCE') || name.includes('ফিনান্স')) return 6;
  if (name.includes('STANDARD') || name.includes('স্ট্যান্ডার্ড')) return 5;
  if (name.includes('ACADEMIC') || name.includes('একাডেমিক')) return 4;
  if (name.includes('SMART') || name.includes('স্মার্ট')) return 3;
  if (name.includes('BASIC') || name.includes('বেসিক')) return 2;

  return 1;
};

export const hasAdmissionFormAccess = (madrasah: any, isSuperAdmin: boolean = false): boolean => {
  if (isSuperAdmin) return true;
  
  // Account must be active
  const isActive = madrasah?.status === 'active';
  if (!isActive) return false;

  const pkgRaw = madrasah?.config_json?.package_name || madrasah?.config_json?.subscription?.package_name || '';
  const level = getPackageLevel(pkgRaw);

  // Standard package (level 5) up to Ultimate package (level 10)
  return level >= 5;
};
