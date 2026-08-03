/** Chuẩn hóa mã/tên/loại máy để so khớp (bỏ dấu, khoảng trắng). */
export function normalizeMachineKindText(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Máy tái chế: loại/mã/tên chứa "tái chế" / recycle. */
export function isRecyclingMachineText(...candidates: Array<string | undefined | null>) {
  return candidates.some(value => {
    const raw = String(value || '').trim();
    if (!raw || raw === '-') return false;
    const compact = normalizeMachineKindText(raw);
    return (
      compact.includes('taiche') ||
      compact.includes('recycle') ||
      compact.includes('recycling')
    );
  });
}

export function isRecyclingMachine(
  machine: { code?: string; name?: string; type?: string } | null | undefined
) {
  if (!machine) return false;
  return isRecyclingMachineText(machine.type, machine.code, machine.name);
}
