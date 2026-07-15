import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeBaseUrl(value?: string) {
  const raw = (value || '').replace(/\/+$/, '');
  if (
    typeof window !== 'undefined' &&
    window.location?.hostname &&
    !['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(raw)
  ) {
    return '';
  }
  return raw;
}

export function getApiBase() {
  return normalizeBaseUrl(process.env.EXPO_PUBLIC_BACKEND_URL);
}

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'employee' | 'manager' | 'owner' | 'admin';
  store_location?: string;
  created_at?: string;
};

const TOKEN_KEY = 'auth_token';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, opts: RequestInit = {}) {
  const token = await getToken();
  const method = opts.method || 'GET';
  const url = `${getApiBase()}/api${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = data?.detail || data || `HTTP ${res.status}`;
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail);
    const error = `${method} ${url} failed (${res.status}): ${message}`;
    console.error(error);
    throw new Error(error);
  }
  return data;
}

export const api = {
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, name: string) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  me: () => request('/auth/me'),

  attendanceStatus: () => request('/attendance/status'),
  checkIn: (latitude?: number | null, longitude?: number | null, address?: string | null, local_date?: string, local_time?: string) =>
    request('/attendance/checkin', { method: 'POST', body: JSON.stringify({ latitude, longitude, address, local_date, local_time }) }),
  checkOut: (latitude?: number | null, longitude?: number | null, address?: string | null, local_date?: string, local_time?: string) =>
    request('/attendance/checkout', { method: 'POST', body: JSON.stringify({ latitude, longitude, address, local_date, local_time }) }),
  myAttendance: () => request('/attendance/mine'),

  myShifts: () => request('/shifts/mine'),
  createShift: (date: string, start_time: string, end_time: string, note = '', store_location = '', shift_type = '') =>
    request('/shifts', { method: 'POST', body: JSON.stringify({ date, start_time, end_time, note, store_location, shift_type }) }),
  updateMyShift: (id: string, body: { date: string; start_time: string; end_time: string; note?: string; store_location?: string; shift_type?: string }) =>
    request(`/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteShift: (id: string) => request(`/shifts/${id}`, { method: 'DELETE' }),

  adminEmployees: () => request('/admin/employees'),
  adminUpdateUserRole: (id: string, role: 'employee' | 'manager' | 'owner' | 'admin', store_location = '') =>
    request(`/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role, store_location }) }),
  adminAttendance: () => request('/admin/attendance'),
  adminCreateAttendance: (body: {
    user_id: string;
    check_in?: string;
    check_out?: string | null;
    store_location?: string;
    shift_id?: string;
    check_in_local_date?: string;
    check_in_local_time?: string;
    check_out_local_time?: string;
    note?: string;
  }) => request('/admin/attendance', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateAttendance: (id: string, body: any) =>
    request(`/admin/attendance/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminApproveAttendance: (id: string) =>
    request(`/admin/attendance/${id}/approve`, { method: 'POST' }),
  adminRejectAttendance: (id: string) =>
    request(`/admin/attendance/${id}/reject`, { method: 'POST' }),
  adminShifts: () => request('/admin/shifts'),
  adminCreateShift: (body: { user_id: string; date: string; start_time: string; end_time: string; note?: string; store_location?: string; shift_type?: string }) =>
    request('/admin/shifts', { method: 'POST', body: JSON.stringify(body) }),
  adminStats: () => request('/admin/stats'),
  adminReports: (period: 'all' | 'month' | 'week' = 'all') => request(`/admin/reports?period=${period}`),
  adminEmployeeReport: (userId: string, period: 'all' | 'month' | 'week' = 'all') =>
    request(`/admin/reports/${userId}?period=${period}`),

  // calendar / shift management
  allShifts: (start?: string, end?: string) =>
    request(`/shifts/all${start && end ? `?start=${start}&end=${end}` : ''}`),
  adminUpdateShift: (id: string, body: any) =>
    request(`/admin/shifts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteShift: (id: string) =>
    request(`/admin/shifts/${id}`, { method: 'DELETE' }),

  // swap requests
  createSwap: (my_shift_id: string, target_shift_id: string, message = '') =>
    request('/swap-requests', { method: 'POST', body: JSON.stringify({ my_shift_id, target_shift_id, message }) }),
  createSwapNew: (
    my_shift_id: string,
    new_shift: { date: string; start_time: string; end_time: string; note?: string; store_location?: string; shift_type?: string },
    message = ''
  ) => request('/swap-requests', { method: 'POST', body: JSON.stringify({ my_shift_id, new_shift, message }) }),
  listSwaps: () => request('/swap-requests'),
  acceptSwap: (id: string) => request(`/swap-requests/${id}/accept`, { method: 'POST' }),
  rejectSwap: (id: string) => request(`/swap-requests/${id}/reject`, { method: 'POST' }),

  // admin overrides
  adminListSwaps: () => request('/admin/swap-requests'),
  adminForceApproveSwap: (id: string) => request(`/admin/swap-requests/${id}/force-approve`, { method: 'POST' }),
  adminForceRejectSwap: (id: string) => request(`/admin/swap-requests/${id}/force-reject`, { method: 'POST' }),

  // shift approval
  adminPendingShifts: () => request('/admin/shifts/pending'),
  adminApproveShift: (id: string) => request(`/admin/shifts/${id}/approve`, { method: 'POST' }),
  adminRejectShift: (id: string, reason = '') =>
    request(`/admin/shifts/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  adminUnapproveShift: (id: string) => request(`/admin/shifts/${id}/unapprove`, { method: 'POST' }),

  // tasks
  adminTasks: () => request('/admin/tasks'),
  adminCreateTask: (body: { title: string; description?: string; store_location: string; assigned_user_id?: string | null }) =>
    request('/admin/tasks', { method: 'POST', body: JSON.stringify(body) }),
  adminUpdateTask: (id: string, body: any) =>
    request(`/admin/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  adminDeleteTask: (id: string) =>
    request(`/admin/tasks/${id}`, { method: 'DELETE' }),
  myTasks: () => request('/tasks/mine'),
  completeTask: (id: string) => request(`/tasks/${id}/complete`, { method: 'POST' }),

  // notifications
  listNotifications: () => request('/notifications'),
  unreadCount: (): Promise<{ count: number }> => request('/notifications/unread-count'),
  markRead: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllRead: () => request('/notifications/read-all', { method: 'POST' }),

  // monthly report
  adminMonthly: (months = 6) => request(`/admin/reports/monthly?months=${months}`),
};
