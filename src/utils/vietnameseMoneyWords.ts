const CHU_SO = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const CHU_DON_VI = ['', 'nghìn', 'triệu', 'tỷ'];

function capitalizeFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function docBaSo(so: number) {
  const tram = Math.floor(so / 100);
  const chuc = Math.floor((so % 100) / 10);
  const donVi = so % 10;
  let result = '';

  if (tram > 0) {
    result += `${CHU_SO[tram]} trăm`;
    if (chuc === 0 && donVi > 0) result += ' lẻ';
    result += ' ';
  }

  if (chuc > 1) {
    result += `${CHU_SO[chuc]} mươi`;
    if (donVi === 1) result += ' mốt';
    else if (donVi === 5) result += ' lăm';
    else if (donVi > 0) result += ` ${CHU_SO[donVi]}`;
    result += ' ';
  } else if (chuc === 1) {
    result += 'mười';
    if (donVi === 5) result += ' lăm';
    else if (donVi > 0) result += ` ${CHU_SO[donVi]}`;
    result += ' ';
  } else if (donVi > 0 || (tram === 0 && chuc === 0)) {
    result += CHU_SO[donVi];
    result += ' ';
  }

  return result.trim();
}

function docSoNguyen(so: number) {
  if (so === 0) return CHU_SO[0];
  let result = '';
  let unitIndex = 0;

  while (so > 0) {
    const block = so % 1000;
    if (block > 0) {
      const blockText = docBaSo(block);
      const unit = CHU_DON_VI[unitIndex];
      result = `${blockText}${unit ? ` ${unit}` : ''}${result ? ` ${result}` : ''}`.trim();
    }
    so = Math.floor(so / 1000);
    unitIndex += 1;
  }

  return result.trim();
}

/** Đọc số tiền thành chữ tiếng Việt (đồng). */
export function formatVietnameseMoneyWords(amount: number) {
  if (!Number.isFinite(amount) || amount === 0) return 'Không đồng';
  const rounded = Math.round(Math.abs(amount));
  const text = docSoNguyen(rounded);
  return `${capitalizeFirst(text)} đồng`;
}
