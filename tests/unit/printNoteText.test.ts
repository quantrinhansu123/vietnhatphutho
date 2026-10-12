/**
 * Bóc tiền tố mã đơn / mã SP / tên ghép khỏi ghi chú dòng khi in lệnh SX —
 * chạy: npx tsx --test tests/unit/printNoteText.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractBareNoteText } from '../../src/features/_shared/productionProductHelpers';

const TEN_GHEP = 'NHỰA SÓNG TRẮNG - NP - 11 SÓNG 5,4KG - 5m';

describe('in lệnh SX — ô ghi chú chỉ còn nội dung', () => {
  it('bóc "mã đơn - mã SP - … tên ghép: ghi chú" còn "ghi chú"', () => {
    assert.equal(
      extractBareNoteText(
        `DH232 - ST505 - 5.4kg - NP: ${TEN_GHEP}: ghi chú 5`,
        { orderCode: 'DH232', productCode: 'ST505 - 5.4kg - NP', tenGhep: TEN_GHEP }
      ),
      'ghi chú 5'
    );
  });

  it('bóc khi mã SP ngắn, phần spec còn lại trước tên ghép', () => {
    assert.equal(
      extractBareNoteText(`DH232 - ST505 - 5.4kg - NP: ${TEN_GHEP}: ghi chú 7`, {
        orderCode: 'DH232',
        productCode: 'ST505',
        tenGhep: TEN_GHEP
      }),
      'ghi chú 7'
    );
  });

  it('ghi chú thường không tiền tố giữ nguyên', () => {
    assert.equal(
      extractBareNoteText('giao gấp trước 10h', {
        orderCode: 'DH232',
        productCode: 'ST505',
        tenGhep: TEN_GHEP
      }),
      'giao gấp trước 10h'
    );
  });

  it('câu chữ chứa tên ghép ở giữa không bị cắt', () => {
    const note = `làm theo đúng ${TEN_GHEP} giúp shop`;
    assert.equal(
      extractBareNoteText(note, {
        orderCode: 'DH232',
        productCode: 'ST505',
        tenGhep: TEN_GHEP
      }),
      note
    );
  });

  it('rỗng thì rỗng', () => {
    assert.equal(extractBareNoteText('', { orderCode: 'DH1' }), '');
  });
});
