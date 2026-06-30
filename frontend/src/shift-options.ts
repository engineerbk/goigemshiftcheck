export const STORE_LOCATIONS: string[] = [
  '74 Hàng Nón',
  '4B Trần Phú',
  '32 Hàng Bè',
  '07 Nhà Chung',
  '53 Lương Ngọc Quyến',
  '13 Lý Quốc Sư',
  'Kho Tổng 22-89C',
];

export type ShiftPreset = {
  type: 'morning' | 'afternoon' | 'evening';
  start: string;
  end: string;
};

export const SHIFT_PRESETS: ShiftPreset[] = [
  { type: 'morning', start: '08:30', end: '12:30' },
  { type: 'afternoon', start: '12:30', end: '18:00' },
  { type: 'evening', start: '18:00', end: '22:30' },
];
